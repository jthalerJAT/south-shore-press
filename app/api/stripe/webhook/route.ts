import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_TIERS, type PlanTier } from '@/lib/stripe/plans';

/** Map a Stripe plan tier onto the Account Database's account_type. The
 *  introductory offer is a yearly print delivery, so it lives as paid_yearly —
 *  reports, label exports, and lapse expiry all treat it like any annual sub. */
const TIER_TO_ACCOUNT_TYPE: Record<PlanTier, string> = {
  all_access: 'paid_all_access',
  print_annual: 'paid_yearly',
  print_monthly: 'paid_monthly',
  intro_annual: 'paid_yearly',
};

// The webhook needs the raw request body for signature verification and
// Node crypto — it cannot run on the edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 *
 * Stripe's source-of-truth feed. Verifies the signature against the raw
 * body, dedupes redelivered events, and syncs subscription state.
 *
 * Multi-subscription model: each Stripe subscription maps to one
 * `subscription_orders` row (the authoritative per-sub record). After
 * syncing the affected row, we recompute the cheap aggregate on `profiles`
 * (`subscription_status` = active if ANY of the user's subs is active;
 * `subscription_tier` = their best active tier) for fast paywall gating.
 *
 * Version-robustness: recent Stripe accounts default to an API version
 * where the subscription reference moved off the invoice and the period
 * dates moved onto items. We read every shape and re-fetch subscriptions
 * with our pinned SDK so field locations are consistent.
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
    return NextResponse.json({ error: 'Handler error.' }, { status: 500 });
  }

  const { error: recordErr } = await admin
    .from('processed_stripe_events')
    .insert({ event_id: event.id });
  if (recordErr && recordErr.code !== '23505') {
    console.error('[stripe webhook] could not record event id', recordErr);
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

function nowIso() {
  return new Date().toISOString();
}

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
 *  first subscription item (newer). ISO string or null. */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as Record<string, any>;
  const unix = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

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
 *  to leave the order row's status unchanged (e.g. incomplete). */
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
      return null;
  }
}

/** Best (highest-value) tier from a set — PLAN_TIERS is already ordered
 *  all_access > print_annual > intro_annual > print_monthly. */
function bestTier(tiers: PlanTier[]): PlanTier | null {
  for (const t of PLAN_TIERS) {
    if (tiers.includes(t)) return t;
  }
  return null;
}

/** Recompute the aggregate flags on `profiles` from ALL of a user's order
 *  rows. `subscription_status` is active if any sub is active; tier is the
 *  best active tier. */
async function recomputeProfileAggregate(admin: Admin, userId: string) {
  const { data: orders } = await admin
    .from('subscription_orders')
    .select('plan_tier, status, started_at, current_period_end, stripe_subscription_id')
    .eq('user_id', userId);

  const rows = (orders ?? []) as Array<{
    plan_tier: PlanTier;
    status: string;
    started_at: string | null;
    current_period_end: string | null;
    stripe_subscription_id: string | null;
  }>;
  const activeRows = rows.filter((o) => o.status === 'active');
  const activeTiers = activeRows.map((o) => o.plan_tier);

  let status: string | null;
  let tier: PlanTier | null = null;
  if (activeTiers.length > 0) {
    status = 'active';
    tier = bestTier(activeTiers);
  } else if (rows.some((o) => o.status === 'past_due')) {
    status = 'past_due';
  } else if (rows.some((o) => o.status === 'canceled')) {
    status = 'canceled';
  } else {
    status = null;
  }

  const { error } = await admin
    .from('profiles')
    .update({ subscription_status: status, subscription_tier: tier })
    .eq('id', userId);
  if (error) console.error('[stripe webhook] profile aggregate failed', error);

  // Sync the master Account Database record. Only touch account_type/status on
  // a decisive transition so a still-pending checkout (status null) never flips
  // a fresh digital account to expired.
  if (status === 'active' && tier) {
    // Earliest start, latest renewal across active subs; best-tier's Stripe ids.
    const starts = activeRows.map((o) => o.started_at).filter(Boolean).sort() as string[];
    const ends = activeRows.map((o) => o.current_period_end).filter(Boolean).sort() as string[];
    const best = activeRows.find((o) => o.plan_tier === tier);
    const patch: Record<string, unknown> = {
      account_type: TIER_TO_ACCOUNT_TYPE[tier],
      status: 'active',
      updated_at: nowIso(),
    };
    if (starts.length) patch.subscription_start = starts[0].slice(0, 10);
    if (ends.length) patch.subscription_end = ends[ends.length - 1].slice(0, 10);
    if (best?.stripe_subscription_id) patch.stripe_subscription_id = best.stripe_subscription_id;
    const { error: acctErr } = await admin.from('accounts').update(patch).eq('user_id', userId);
    if (acctErr) console.error('[stripe webhook] account sync failed', acctErr);
  } else if (status === 'canceled') {
    // Formerly paid, now fully lapsed → mark the account expired (keep the paid
    // account_type so it reads as "was a paid subscriber who lapsed").
    const { error: acctErr } = await admin
      .from('accounts')
      .update({ status: 'expired', updated_at: nowIso() })
      .eq('user_id', userId);
    if (acctErr) console.error('[stripe webhook] account expire failed', acctErr);
  }
}

/** Sync one subscription onto its order row, then recompute the aggregate. */
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

  const orderStatus = orderStatusFor(sub.status);
  const orderPatch: Record<string, unknown> = {
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: periodEndIso(sub),
    updated_at: nowIso(),
  };
  if (orderStatus) orderPatch.status = orderStatus;
  if (opts.markStarted) orderPatch.started_at = nowIso();

  const { error: orderErr } = await admin
    .from('subscription_orders')
    .update(orderPatch)
    .eq('stripe_subscription_id', sub.id);
  if (orderErr) console.error('[stripe webhook] order sync failed', orderErr);

  await recomputeProfileAggregate(admin, userId);
}

async function handleSubscriptionDeleted(admin: Admin, sub: Stripe.Subscription) {
  const userId = await resolveUserId(admin, sub);
  await admin
    .from('subscription_orders')
    .update({ status: 'canceled', cancel_at_period_end: false, updated_at: nowIso() })
    .eq('stripe_subscription_id', sub.id);
  if (userId) await recomputeProfileAggregate(admin, userId);
}

async function handleInvoicePaid(stripe: Stripe, admin: Admin, invoice: Stripe.Invoice) {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) {
    console.error('[stripe webhook] invoice.paid had no subscription id', invoice.id);
    return;
  }
  const sub = (await stripe.subscriptions.retrieve(subId)) as Stripe.Subscription;

  // First paid invoice for this order → stamp started_at.
  const { data: order } = await admin
    .from('subscription_orders')
    .select('started_at')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();
  const markStarted = !order?.started_at;

  await syncSubscription(admin, sub, { markStarted });

  // Snapshot the saved card onto the profile + master account so
  // /account/payment and the Account Database both show it.
  const userId = await resolveUserId(admin, sub);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (userId && customerId) {
    await syncDefaultPaymentMethod(stripe, admin, customerId, userId);
  }

  // Record the last payment (date + amount) on the master account record.
  if (userId) {
    await admin
      .from('accounts')
      .update({
        last_payment_date: nowIso().slice(0, 10),
        last_payment_amount: (invoice.amount_paid ?? 0) / 100,
        updated_at: nowIso(),
      })
      .eq('user_id', userId);
  }
}

async function handleInvoiceFailed(admin: Admin, invoice: Stripe.Invoice) {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;
  await admin
    .from('subscription_orders')
    .update({ status: 'past_due', updated_at: nowIso() })
    .eq('stripe_subscription_id', subId);
  const { data: order } = await admin
    .from('subscription_orders')
    .select('user_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();
  if (order?.user_id) await recomputeProfileAggregate(admin, order.user_id as string);
}

/** Read the customer's default payment method and cache last4 + brand on
 *  the profile. Best-effort — never throws into the handler. */
async function syncDefaultPaymentMethod(
  stripe: Stripe,
  admin: Admin,
  customerId: string,
  userId: string
) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return;
    const dpm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    const pmId = typeof dpm === 'string' ? dpm : dpm?.id ?? null;
    if (!pmId) return;
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const last4 = pm.card?.last4 ?? null;
    const brand = pm.card?.brand ?? null;
    await admin
      .from('profiles')
      .update({
        has_payment_method: true,
        payment_method_last4: last4,
        payment_method_brand: brand,
      })
      .eq('id', userId);
    // Mirror onto the master account record (single source of truth).
    await admin
      .from('accounts')
      .update({
        stripe_customer_id: customerId,
        has_payment_method: true,
        payment_method_last4: last4,
        payment_method_brand: brand,
        updated_at: nowIso(),
      })
      .eq('user_id', userId);
  } catch (err) {
    console.error('[stripe webhook] card snapshot failed', err);
  }
}
