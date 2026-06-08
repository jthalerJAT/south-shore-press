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
 * body (never req.json() — re-parsing changes the bytes), dedupes
 * redelivered events, and syncs subscription state onto `profiles` +
 * `subscription_orders` via the service-role client.
 *
 * Version-robustness: Stripe accounts created recently default to a newer
 * API version where the subscription reference moved off the invoice
 * (now invoice.parent.subscription_details.subscription) and the period
 * dates moved onto line/subscription items. We read every shape, and for
 * the canonical fields we re-fetch the subscription with our pinned SDK
 * so the data is consistent regardless of the event's API version.
 *
 * Subscribe to: customer.subscription.created / updated / deleted,
 * invoice.paid, invoice.payment_failed.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
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

  // Best-effort idempotency: if we've already recorded this event, skip.
  // Never fatal — our handlers set absolute values, so reprocessing is safe.
  const { data: seen } = await admin
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (seen) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const obj = event.data.object as Stripe.Subscription;
        // Re-fetch with our pinned SDK for consistent field locations.
        const sub = await stripe.subscriptions.retrieve(obj.id);
        await syncSubscription(admin, sub as Stripe.Subscription);
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
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler error for ${event.type}`, err);
    // Return 500 WITHOUT recording the event so Stripe retries it.
    return NextResponse.json({ error: 'Handler error.' }, { status: 500 });
  }

  // Record the event only after successful processing (best-effort).
  const { error: recordErr } = await admin
    .from('processed_stripe_events')
    .insert({ event_id: event.id });
  if (recordErr && recordErr.code !== '23505') {
    console.error('[stripe webhook] could not record event id', recordErr);
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

/** Pull the subscription id off an invoice, across API-version shapes. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as Record<string, any>;
  const candidates = [
    inv.subscription,
    inv.parent?.subscription_details?.subscription,
    inv.lines?.data?.[0]?.parent?.subscription_item_details?.subscription,
    inv.lines?.data?.[0]?.subscription,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
    if (c && typeof c === 'object' && typeof c.id === 'string') return c.id;
  }
  return null;
}

/** current_period_end across shapes: subscription top-level (older) or the
 *  first subscription item (newer). Returns an ISO string or null. */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as Record<string, any>;
  const unix = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/** Resolve the Supabase user id for a subscription — metadata first, then a
 *  customer-id lookup. */
async function resolveUserId(admin: Admin, sub: Stripe.Subscription): Promise<string | null> {
  const metaId = sub.metadata?.supabase_user_id;
  if (metaId) return metaId;

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Map a Stripe subscription status onto the order-status CHECK set, or null
 *  to leave the order row unchanged. */
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
      return null; // incomplete, paused → leave as-is
  }
}

/** Write the snapshot fields onto profiles + the matching order row. */
async function syncSubscription(
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

  const profilePatch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_cancel_at_period_end: sub.cancel_at_period_end,
    subscription_current_period_end: periodEndIso(sub),
  };
  if (tier) profilePatch.subscription_tier = tier;
  if (opts.markStarted) {
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
    const { error } = await admin
      .from('profiles')
      .update({
        subscription_status: 'canceled',
        subscription_tier: null,
        stripe_subscription_id: null,
        subscription_cancel_at_period_end: false,
      })
      .eq('id', userId);
    if (error) console.error('[stripe webhook] delete profile sync failed', error);
  }
  await admin
    .from('subscription_orders')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);
}

async function handleInvoicePaid(stripe: Stripe, admin: Admin, invoice: Stripe.Invoice) {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) {
    console.error('[stripe webhook] invoice.paid had no subscription id', invoice.id);
    return;
  }
  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = await resolveUserId(admin, sub as Stripe.Subscription);
  let markStarted = false;
  if (userId) {
    const { data } = await admin
      .from('profiles')
      .select('subscription_started_at')
      .eq('id', userId)
      .maybeSingle();
    markStarted = !data?.subscription_started_at;
  }
  await syncSubscription(admin, sub as Stripe.Subscription, { markStarted });
}

async function handleInvoiceFailed(admin: Admin, invoice: Stripe.Invoice) {
  const inv = invoice as unknown as Record<string, any>;
  const customerId =
    typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null;
  const subId = invoiceSubscriptionId(invoice);

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
