import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Customer-portal queries (Ad Portal / Legal Portal, migration 040).
 * All reads use the service-role client AFTER the caller has verified the
 * signed-in user holds the relevant customer credential — customers have no
 * direct RLS grants on the Ad Database tables.
 */

export type CustomerProfile = {
  user_id: string;
  customer_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type CustomerAd = {
  id: string;
  storage_path: string;
  file_name: string | null;
  copy_size: string | null;
  notes: string | null;
  created_at: string;
};

export type CustomerLegal = {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  header: string;
  body: string;
  l_number: string;
  start_date: string;
  end_date: string;
  run_dates: string[];
  notary_required: boolean;
  created_at: string;
};

/** The signed-in customer's billing profile — auto-seeded (in memory, not
 *  persisted) from their signup data when they haven't saved one yet. */
export async function getCustomerProfile(userId: string): Promise<CustomerProfile> {
  const admin = createAdminClient();
  const { data: saved } = await admin
    .from('customer_profiles')
    .select('user_id, customer_name, contact_name, contact_phone, contact_email, street, street2, city, state, zip')
    .eq('user_id', userId)
    .maybeSingle();
  if (saved) return saved as CustomerProfile;

  // First visit: prefill from the account-creation profile fields.
  const { data: p } = await admin
    .from('profiles')
    .select('display_name, first_name, last_name, email, phone, street_address, city, state, zip_code')
    .eq('id', userId)
    .maybeSingle();
  const prof = (p ?? {}) as Record<string, string | null>;
  const fullName =
    [prof.first_name, prof.last_name].filter(Boolean).join(' ') ||
    prof.display_name ||
    null;
  return {
    user_id: userId,
    customer_name: fullName,
    contact_name: fullName,
    contact_phone: prof.phone ?? null,
    contact_email: prof.email ?? null,
    street: prof.street_address ?? null,
    street2: null,
    city: prof.city ?? null,
    state: prof.state ?? null,
    zip: prof.zip_code ?? null,
  };
}

/** The user's linked Ad Database client file id (advertiser credential). */
export async function getLinkedAdClientId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('ad_client_id')
    .eq('id', userId)
    .maybeSingle();
  return ((data as { ad_client_id?: string | null } | null)?.ad_client_id ?? null) as string | null;
}

/** Every copy file in the customer's linked client file, newest first. */
export async function getCustomerAds(clientId: string): Promise<CustomerAd[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ad_files')
    .select('id, storage_path, file_name, copy_size, notes, created_at')
    .eq('client_id', clientId)
    .eq('kind', 'copy')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getCustomerAds]', error);
    return [];
  }
  return (data ?? []) as CustomerAd[];
}

/** The customer's own legals, newest first. */
export async function getCustomerLegals(userId: string): Promise<CustomerLegal[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customer_legals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getCustomerLegals]', error);
    return [];
  }
  return (data ?? []) as CustomerLegal[];
}

/** Every customer legal ever uploaded — the admin Legal Database. */
export async function getAllCustomerLegals(): Promise<CustomerLegal[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customer_legals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('[getAllCustomerLegals]', error);
    return [];
  }
  return (data ?? []) as CustomerLegal[];
}

/** One customer legal by id (admin read-only view). */
export async function getCustomerLegal(id: string): Promise<CustomerLegal | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customer_legals')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[getCustomerLegal]', error);
    return null;
  }
  return data as CustomerLegal;
}
