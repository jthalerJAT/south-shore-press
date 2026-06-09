import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPriceId, isPlanTier } from '@/lib/stripe/plans';
import { normalizePhoneForStorage } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscriptions/create
 *
 * Creates an auto-renewing Stripe Subscription for the signed-in user and
 * persists the delivery + billing snapshot to `subscription_orders`.
 *
 * Flow:
 *   1. Validate the tier and resolve its Stripe Price ID (env-backed).
 *   2. Refuse if the user already has an active subscription.
 *   3. Ensure the user has a Stripe Customer (lazy-create, mirrors
 *      /api/payments/setup-intent).
 *   4. Insert a `pending` order row BEFORE the Stripe call so the order
 *      always exists for reconciliation if the Stripe call throws.
 *   5. Create the subscription with `payment_behavior: 'default_incomplete'`
 *      and expand the first invoice's PaymentIntent.
 *   6. New card  → return the PI client_secret; the client confirms with
 *      Stripe Elements.
 *      Saved card → confirm the PI server-side with the default payment
 *      method; return 'complete' or 'requires_action' (3DS).
 *
 * The webhook — NOT this response — is the source of truth that flips
 * `profiles.subscription_status` to 'active'.
 */

type AddressPayload = {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  phone?: string;
};

type CreateBody = {
  planTier?: unknown;
  delivery?: AddressPayload;
  billing?: AddressPayload | null;
  billingSameAsDelivery?: boolean;
  useExistingCard?: boolean;
};

function cleanAddress(a: AddressPayload | undefined | null) {
  const v = (s: string | undefined) => (s ?? '').toString().trim() || null;
  return {
    first_name: v(a?.first_name),
    last_name: v(a?.last_name),
    company: v(a?.company),
    address_1: v(a?.address_1),
    address_2: v(a?.address_2),
    city: v(a?.city),
    state: v(a?.state),
    zip: v(a?.zip),
    email: v(a?.email),
    phone: a?.phone ? normalizePhoneForStorage(a.phone) : null,
  };
}

/** Required delivery fields. Company + address_2 are optional. */
function missingDeliveryFields(d: ReturnType<typeof cleanAddress>): string[] {
  const required: Array<[keyof typeof d, string]> = [
    ['first_name', 'first name'],
    ['last_name', 'last name'],
    ['address_1', 'address'],
    ['city', 'city'],
    ['state', 'state'],
    ['zip', 'ZIP code'],
    ['email', 'email'],
    ['phone', 'phone'],
  ];
  return required.filter(([k]) => !d[k]).map(([, label]) => label);
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not enabled on this deployment.' },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;

  if (!isPlanTier(body.planTier)) {
    return NextResponse.json({ error: 'Unknown subscription plan.' }, { status: 400 });
  }
  const planTier = body.planTier;

  const priceId = getPriceId(planTier);
  if (!priceId) {
    return NextResponse.json(
      { error: 'This plan is not available yet. Please try again later.' },
      { status: 400 }
    );
  }

  const billingSame = body.billingSameAsDelivery !== false;
  const delivery = cleanAddress(body.delivery);
  const billing = billingSame ? delivery : cleanAddress(body.billing);

  const missing = missingDeliveryFields(delivery);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Please complete your delivery information: ${missing.join(', ')}.` },
      { status: 400 }
    );
  }
  if (!billingSame) {
    const billingMissing = missingDeliveryFields(billing);
    if (billingMissing.length > 0) {
      return NextResponse.json(
        { error: `Please complete your billing information: ${billingMissing.join(', ')}.` },
        { status: 400 }
      );
    }
  }

  const supabase = createClient();

  // Load profile: existing customer id, name, current subscription state.
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('stripe_customer_id, first_name, last_name, email, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('[subscriptions/create] profile fetch failed', profileErr);
    return NextResponse.json({ error: 'Profile lookup failed.' }, { status: 500 });
  }

  // A customer may hold several concurrent subscriptions (e.g. their own
  // plan plus a gift), so we intentionally do NOT block on an existing
  // active subscription — each checkout creates a new one.

  // Ensure a Stripe Customer (mirrors setup-intent's lazy-create).
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
      undefined;
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      name,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    const { error: writeErr } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
    if (writeErr) {
      console.error('[subscriptions/create] customer id write failed', writeErr);
    }
  }

  // Insert the pending order row BEFORE the Stripe call.
  const { data: order, error: orderErr } = await supabase
    .from('subscription_orders')
    .insert({
      user_id: user.id,
      plan_tier: planTier,
      status: 'pending',
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      delivery_first_name: delivery.first_name,
      delivery_last_name: delivery.last_name,
      delivery_company: delivery.company,
      delivery_address_1: delivery.address_1,
      delivery_address_2: delivery.address_2,
      delivery_city: delivery.city,
      delivery_state: delivery.state,
      delivery_zip: delivery.zip,
      delivery_email: delivery.email,
      delivery_phone: delivery.phone,
      billing_same_as_delivery: billingSame,
      billing_first_name: billing.first_name,
      billing_last_name: billing.last_name,
      billing_company: billing.company,
      billing_address_1: billing.address_1,
      billing_address_2: billing.address_2,
      billing_city: billing.city,
      billing_state: billing.state,
      billing_zip: billing.zip,
      billing_email: billing.email,
      billing_phone: billing.phone,
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    console.error('[subscriptions/create] order insert failed', orderErr);
    return NextResponse.json({ error: 'Could not start your order.' }, { status: 500 });
  }
  const orderId = order.id as string;

  // Does the customer have a saved default card we can charge?
  let defaultPaymentMethod: string | null = null;
  if (body.useExistingCard) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer && customer.deleted)) {
      const dpm = (customer as Stripe.Customer).invoice_settings
        ?.default_payment_method;
      defaultPaymentMethod = typeof dpm === 'string' ? dpm : dpm?.id ?? null;
    }
  }

  // Create the auto-renewing subscription. default_incomplete leaves the
  // first invoice unpaid until we confirm its PaymentIntent.
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent'],
        ...(defaultPaymentMethod
          ? { default_payment_method: defaultPaymentMethod }
          : {}),
        metadata: {
          supabase_user_id: user.id,
          order_id: orderId,
          plan_tier: planTier,
        },
      },
      { idempotencyKey: `sub_create_${orderId}` }
    );
  } catch (err) {
    console.error('[subscriptions/create] stripe subscription create failed', err);
    return NextResponse.json(
      { error: 'Could not create your subscription. Please try again.' },
      { status: 502 }
    );
  }

  // Persist the subscription id on the order.
  await supabase
    .from('subscription_orders')
    .update({ stripe_subscription_id: subscription.id, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  const invoice = subscription.latest_invoice as Stripe.Invoice | null;
  const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

  if (!paymentIntent) {
    // No PI means nothing to pay (unexpected for our paid plans). The
    // webhook will reconcile via invoice.paid if it does settle.
    return NextResponse.json({
      orderId,
      subscriptionId: subscription.id,
      mode: 'complete' as const,
    });
  }

  // Saved-card path: confirm server-side so the user doesn't re-enter a card.
  if (defaultPaymentMethod) {
    try {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id);
      if (confirmed.status === 'succeeded') {
        return NextResponse.json({
          orderId,
          subscriptionId: subscription.id,
          mode: 'complete' as const,
        });
      }
      if (confirmed.status === 'requires_action') {
        return NextResponse.json({
          orderId,
          subscriptionId: subscription.id,
          clientSecret: confirmed.client_secret,
          mode: 'requires_action' as const,
        });
      }
      // requires_payment_method / canceled → the saved card failed.
      return NextResponse.json(
        { error: 'Your saved card was declined. Please try a different card.' },
        { status: 402 }
      );
    } catch (err) {
      console.error('[subscriptions/create] saved-card confirm failed', err);
      return NextResponse.json(
        { error: 'Could not charge your saved card. Please try a different card.' },
        { status: 402 }
      );
    }
  }

  // New-card path: hand the client secret back for Elements confirmation.
  return NextResponse.json({
    orderId,
    subscriptionId: subscription.id,
    clientSecret: paymentIntent.client_secret,
    mode: 'confirm' as const,
  });
}
