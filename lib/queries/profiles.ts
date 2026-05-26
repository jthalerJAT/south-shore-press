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

