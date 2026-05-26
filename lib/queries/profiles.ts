import { createClient } from '@/lib/supabase/server';

/**
 * Profile queries for the Credentials page. Admin-tier only — the
 * RLS policy on `profiles` enforces this server-side (see
 * db/migrations/002_profiles_roles_array.sql).
 */

export type ProfileForCredentials = {
  id: string;
  email: string;
  display_name: string | null;
  /** Multi-role array. Possibly empty for users with no editor-tier
   *  access. May contain 'master admin' — caller decides how to render. */
  roles: string[];
};

/** Every profile in the system, sorted by email for stable ordering.
 *  Caller (the credentials page) applies its own client-side sort
 *  based on the column the user clicks. */
export async function getAllProfiles(): Promise<ProfileForCredentials[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, roles')
    .order('email', { ascending: true });
  if (error) {
    console.error('[getAllProfiles]', error);
    return [];
  }
  return (data ?? []) as ProfileForCredentials[];
}

/**
 * Reader-specific profile shape. Excludes role/roles since the Readers
 * section of the Credentials page is display-only — admins manage
 * editorial roles via the existing CredentialsTable, not the Readers
 * table.
 */
export type ReaderRow = {
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
  has_payment_method: boolean;
  subscription_status: string | null;
  subscription_tier: string | null;
  created_at: string;
};

/**
 * Returns every profile whose roles array contains 'reader' AND no
 * editorial role. Sorted newest-first by signup time. Bounded to 500
 * for the initial render; pagination can be added when the list grows.
 */
export async function getAllReaders(): Promise<ReaderRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, display_name, first_name, last_name, phone, street_address, city, state, zip_code, has_payment_method, subscription_status, subscription_tier, created_at, roles'
    )
    .contains('roles', ['reader'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[getAllReaders]', error);
    return [];
  }

  // Exclude anyone who ALSO has an editorial role — those belong in the
  // editor credentials table, not the readers section.
  const editorial = new Set(['journalist', 'editor', 'admin', 'master admin']);
  return (data ?? [])
    .filter((row: { roles?: string[] | null }) => {
      const roles = (row.roles ?? []).map((r) =>
        String(r).toLowerCase().replace(/_/g, ' ')
      );
      return !roles.some((r) => editorial.has(r));
    })
    .map((row) => {
      const { roles: _ignored, ...rest } = row as ReaderRow & { roles?: string[] };
      return rest as ReaderRow;
    });
}
