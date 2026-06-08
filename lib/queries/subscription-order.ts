import { createClient } from '@/lib/supabase/server';
import type { PlanTier } from '@/lib/stripe/plans';

/**
 * Reader-facing view of a subscription order — the delivery/billing
 * snapshot captured at checkout. RLS gates SELECT to the user's own rows.
 */
export type SubscriptionOrder = {
  id: string;
  user_id: string;
  plan_tier: PlanTier;
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'incomplete_expired';
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;

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
  'delivery_first_name, delivery_last_name, delivery_company, delivery_address_1, ' +
  'delivery_address_2, delivery_city, delivery_state, delivery_zip, delivery_email, ' +
  'delivery_phone, billing_same_as_delivery, created_at';

/** Latest order row for a user (by created_at). Null if they've never
 *  started a checkout. Used by /account/subscription to show the saved
 *  delivery address. */
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
