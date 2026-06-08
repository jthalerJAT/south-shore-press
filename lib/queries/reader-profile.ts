import { createClient } from '@/lib/supabase/server';

/**
 * Reader-facing profile shape — the columns /account renders and lets
 * the user edit. Editorial fields (`role`, `roles`) aren't included
 * because readers can't change them.
 */
export type ReaderProfile = {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  stripe_customer_id: string | null;
  has_payment_method: boolean;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  subscription_started_at: string | null;
  stripe_subscription_id: string | null;
  subscription_cancel_at_period_end: boolean;
  subscription_current_period_end: string | null;
};

/** Fetch the signed-in user's own profile (RLS gates this to their row). */
export async function getMyProfile(userId: string): Promise<ReaderProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, display_name, first_name, last_name, phone, street_address, city, state, zip_code, stripe_customer_id, has_payment_method, payment_method_last4, payment_method_brand, subscription_status, subscription_tier, subscription_started_at, stripe_subscription_id, subscription_cancel_at_period_end, subscription_current_period_end'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[getMyProfile]', error);
    return null;
  }
  return (data ?? null) as ReaderProfile | null;
}
