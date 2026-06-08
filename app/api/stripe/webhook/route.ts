import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tierForPriceId } from '@/lib/stripe/plans';

// The webhook needs the raw request body for signature verification and
// Node crypto — it cannot run on the edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 *
 * Stripe's source-of-truth feed. Verifies the signature against the raw
 * body (never req.json() — re-parsing changes the bytes and breaks the
 * signature), dedupes redelivered events via processed_stripe_events,
 * and syncs subscription state onto `profiles` + `subscription_orders`
 * using the service-role client (the webhook has no user session).
 *
 * Subscribe to: customer.subscription.created / updated / deleted,
 * invoice.paid, invoice.payment_failed.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook not configured.' },
      { status: 503 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: insert the event id. A unique-violation means we've
  // already processed this event — no-op. Any other error: let Stripe
  // retry rather than risk a missed sync.
  const { error: dedupeErr } = await admin
    .from('processed_stripe_events')
    .insert({ event_id: event.id });
  if (dedupeErr) {
    if (dedupeErr.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('[stripe webhook] dedupe insert failed', dedupeErr);
    return NextResponse.json({ error: 'Dedupe failed.' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await syncSubscription(stripe, admin, event.data.object as Stripe.Subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.paid': {
        await handleInvoicePaid(stripe, admin, event.data.object as Stripe.Invoice);
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoiceFailed(admin, event.data.object as Stripe.Invoice);
        break;
      }
      default:
        // Unhandled event types are fine — we acknowledge them.
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler error for ${event.type}`, err);
    return NextResponse.json({ error: 'Handler error.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

/** Resolve the Supabase user id for a subscription — metadata first,
 *  then a customer-id lookup as a fallback. */
async function resolveUserId(
  admin: Admin,
  sub: Stripe.Subscription
): Promise<string | null> {
  const metaId = sub.metadata?.supabase_user_id;
  if (metaId) return metaId;

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Map a Stripe subscription status onto the order-status CHECK set.
 *  Returns null for statuses we don't want to write to the order row
 *  (e.g. 'incomplete' — leave it 'pending'). */
function orderStatusFor(status: Stripe.Subscription.Status): string | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete_expired':
      return 'incomplete_expired';
    default:
      return null; // incomplete, paused → leave order as-is
  }
}

/** Core sync for created/updated: write the snapshot fields onto profiles
 *  and the matching order row. */
async function syncSubscription(
  _stripe: Stripe,
  admin: Admin,
  sub: Stripe.Subscription,
  opts: { markStarted?: boolean } = {}
) {
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    console.error('[stripe webhook] could not resolve user for sub', sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const tier = tierForPriceId(priceId);
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const profilePatch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_cancel_at_period_end: sub.cancel_at_period_end,
    subscription_current_period_end: periodEnd,
  };
  if (tier) profilePatch.subscription_tier = tier;
  if (opts.markStarted) {
    // Set the start date only the first time (don't overwrite on renewals).
    profilePatch.subscription_started_at = new Date().toISOString();
  }

  const { error: profErr } = await admin
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId);
  if (profErr) console.error('[stripe webhook] profile sync failed', profErr);

  const orderStatus = orderStatusFor(sub.status);
  if (orderStatus) {
    const { error: orderErr } = await admin
      .from('subscription_orders')
      .update({ status: orderStatus, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id);
    if (orderErr) console.error('[stripe webhook] order sync failed', orderErr);
  }
}

async function handleSubscriptionDeleted(admin: Admin, sub: Stripe.Subscription) {
  const userId = await resolveUserId(admin, sub);
  if (userId) {
    await admin
      .from('profiles')
      .update({
        subscription_status: 'canceled',
        subscription_tier: null,
        stripe_subscription_id: null,
        subscription_cancel_at_period_end: false,
      })
      .eq('id', userId);
  }
  await admin
    .from('subscription_orders')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);
}

async function handleInvoicePaid(stripe: Stripe, admin: Admin, invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subId) return; // not a subscription invoice

  // Retrieve the full subscription for tier/period/metadata, then sync.
  // markStarted only when this is the very first paid invoice.
  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = await resolveUserId(admin, sub);
  let markStarted = false;
  if (userId) {
    const { data } = await admin
      .from('profiles')
      .select('subscription_started_at')
      .eq('id', userId)
      .maybeSingle();
    markStarted = !data?.subscription_started_at;
  }
  await syncSubscription(stripe, admin, sub, { markStarted });
}

async function handleInvoiceFailed(admin: Admin, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;
  const subId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (customerId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data?.id) {
      await admin
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('id', data.id);
    }
  }
  if (subId) {
    await admin
      .from('subscription_orders')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subId);
  }
}
