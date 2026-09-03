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
  /** Legacy single-role column. getCurrentUser and the RLS policies fall
   *  back to THIS whenever `roles` is empty, so access can be granted by a
   *  value the checkboxes don't show — the credentials UI must surface the
   *  drift (Bob Chartuk kept publishing for days while his row read
   *  READER, 2026-07-15). */
  role: string | null;
  /** Linked Ad Database client file (advertiser credential). */
  ad_client_id: string | null;
  /** Account creation time — null when the column predates migration 003. */
  created_at: string | null;
};

/** Every profile in the system, sorted by email for stable ordering.
 *  Caller (the credentials page) applies its own client-side sort
 *  based on the column the user clicks. */
export async function getAllProfiles(): Promise<ProfileForCredentials[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, roles, role, ad_client_id, created_at')
    .order('email', { ascending: true });
  if (error) {
    // Fallback for older schemas (ad_client_id / created_at not present).
    const retry = await supabase
      .from('profiles')
      .select('id, email, display_name, roles, role')
      .order('email', { ascending: true });
    if (retry.error) {
      console.error('[getAllProfiles]', error);
      return [];
    }
    return (retry.data ?? []).map((p) => ({
      ...p,
      ad_client_id: null,
      created_at: null,
    })) as ProfileForCredentials[];
  }
  return (data ?? []).map((p) => ({
    created_at: null,
    ...(p as object),
  })) as ProfileForCredentials[];
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

