import { createClient } from '@/lib/supabase/server';
import type { PlanTier } from '@/lib/stripe/plans';

/**
 * Reader-facing view of a subscription order — the delivery/billing
 * snapshot plus the per-subscription lifecycle state. `subscription_orders`
 * is the authoritative record now that a customer can hold several
 * concurrent subscriptions. RLS gates SELECT to the user's own rows.
 */
export type SubscriptionOrder = {
  id: string;
  user_id: string;
  plan_tier: PlanTier;
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'incomplete_expired';
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;

  cancel_at_period_end: boolean;
  current_period_end: string | null;
  started_at: string | null;

  delivery_first_name: string | null;
  delivery_last_name: string | null;
  delivery_company: string | null;
  delivery_address_1: string | null;
  delivery_address_2: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zip: string | null;
  delivery_email: string | null;
  delivery_phone: string | null;

  billing_same_as_delivery: boolean;

  created_at: string;
};

const ORDER_COLUMNS =
  'id, user_id, plan_tier, status, stripe_subscription_id, stripe_price_id, ' +
  'cancel_at_period_end, current_period_end, started_at, ' +
  'delivery_first_name, delivery_last_name, delivery_company, delivery_address_1, ' +
  'delivery_address_2, delivery_city, delivery_state, delivery_zip, delivery_email, ' +
  'delivery_phone, billing_same_as_delivery, created_at';

/** Latest order row for a user (by created_at). Null if they've never
 *  started a checkout. */
export async function getLatestOrder(
  userId: string
): Promise<SubscriptionOrder | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscription_orders')
    .select(ORDER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getLatestOrder]', error);
    return null;
  }
  return (data ?? null) as SubscriptionOrder | null;
}

/** Statuses that represent a live / currently-relevant subscription the
 *  customer should see and be able to manage. Abandoned checkouts
 *  (`pending`, `incomplete_expired`) and fully-ended ones (`canceled`)
 *  are excluded. */
const CURRENT_STATUSES = ['active', 'trialing', 'past_due'];

/** All current subscriptions for a user, newest first. Each is a distinct
 *  Stripe subscription the customer can cancel/resume on its own. Used by
 *  /account/subscription and the /subscribe existing-subscriber summary. */
export async function getUserSubscriptions(
  userId: string
): Promise<SubscriptionOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscription_orders')
    .select(ORDER_COLUMNS)
    .eq('user_id', userId)
    .in('status', CURRENT_STATUSES)
    .not('stripe_subscription_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getUserSubscriptions]', error);
    return [];
  }
  return (data ?? []) as unknown as SubscriptionOrder[];
}
