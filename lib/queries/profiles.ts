import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

/** Email addresses of every admin / master-admin. Uses the SERVICE-ROLE
 *  client because callers may be unauthenticated (the public notarized-copy
 *  form), so the self-row RLS on profiles would otherwise hide other rows.
 *  Server-only. */
export async function getAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('email, role, roles');
  if (error) {
    console.error('[getAdminEmails]', error);
    return [];
  }
  const norm = (r: unknown) => String(r ?? '').toLowerCase().replace(/_/g, ' ');
  const isAdmin = (p: { role?: unknown; roles?: unknown }) => {
    const single = norm(p.role);
    const arr = Array.isArray(p.roles) ? p.roles.map(norm) : [];
    return (
      single === 'admin' ||
      single === 'master admin' ||
      arr.includes('admin') ||
      arr.includes('master admin')
    );
  };
  return (data ?? [])
    .filter((p) => isAdmin(p as { role?: unknown; roles?: unknown }))
    .map((p) => (p as { email?: string }).email)
    .filter((e): e is string => Boolean(e));
}

