import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side auth helpers. Use from React Server Components, Route
 * Handlers, and Server Actions. The cookie store is read via the
 * @supabase/ssr server client; middleware ensures the cookies are fresh.
 *
 * Role discriminator is `profiles.role` ∈ { 'journalist', 'editor',
 * 'admin' } (lowercase strings, mirrors v1).
 */

export type UserRole =
  | 'journalist'
  | 'editor'
  | 'admin'
  | 'master admin';

/**
 * Roles allowed to edit any story (not just their own), publish,
 * unpublish, downgrade, and view the All Stories table. Add new
 * elevated-permission roles here in one place — the AuthChip,
 * requireRole gates, and server-action permission checks all
 * consult `canManageAllStories` instead of hardcoding role names.
 */
export const EDITOR_TIER_ROLES: ReadonlyArray<UserRole> = [
  'editor',
  'admin',
  'master admin',
];

export function canManageAllStories(role: UserRole): boolean {
  return EDITOR_TIER_ROLES.includes(role);
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  /** Highest-privilege role from `roles`. Kept for back-compat with
   *  existing code that checks `user.role === 'editor'` etc. */
  role: UserRole;
  /** Full set of roles assigned via the Credentials page. Empty if the
   *  user has no editor-tier permissions. */
  roles: UserRole[];
};

/** Priority order for picking the "primary" single role from a roles
 *  array. Earlier entries win. */
const ROLE_PRIORITY: ReadonlyArray<UserRole> = [
  'master admin',
  'admin',
  'editor',
  'journalist',
];

/** Pick the highest-privilege role from an array; null if empty. */
export function pickHighestRole(roles: ReadonlyArray<UserRole>): UserRole | null {
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  return null;
}

/** Normalize a raw role string from the DB. Returns null for unknown
 *  values rather than coercing — caller decides the fallback. */
export function normalizeRole(raw: unknown): UserRole | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).toLowerCase().replace(/_/g, ' ').trim();
  if (
    normalized === 'journalist' ||
    normalized === 'editor' ||
    normalized === 'admin' ||
    normalized === 'master admin'
  ) {
    return normalized;
  }
  return null;
}

/** Admin-tier check — gates the Credentials page and role-mgmt server
 *  actions. Editor-tier (canManageAllStories) is separate; an editor
 *  can publish stories but not manage user credentials. */
export function canManageCredentials(user: {
  roles: ReadonlyArray<UserRole>;
}): boolean {
  return user.roles.some((r) => r === 'admin' || r === 'master admin');
}

/** Best-effort fetch of the signed-in user's auth row + profile. Returns
 *  null when the request is anonymous OR when no profile row exists yet
 *  (which would be a data-integrity issue, but doesn't crash the page). */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, roles')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  // Prefer the new `roles` array; fall back to the legacy single `role`
  // column for users created before the multi-role migration ran. Each
  // entry is normalized (lowercase, underscores → spaces) so the DB can
  // legitimately store either "master_admin" or "master admin" and we
  // see them as the same canonical value.
  const rawArray = Array.isArray(profile.roles) ? profile.roles : [];
  let roles: UserRole[] = rawArray
    .map(normalizeRole)
    .filter((r): r is UserRole => r !== null);

  if (roles.length === 0) {
    const single = normalizeRole(profile.role);
    if (single) roles = [single];
  }

  // Default single-role view: highest-priv role from the set, or
  // 'journalist' so downstream code never crashes on `user.role`.
  const role = pickHighestRole(roles) ?? 'journalist';

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role,
    roles,
  };
}

/** Redirect to /signin if not authenticated; return the user otherwise.
 *  `returnTo` is round-tripped through a ?next= param so the user lands
 *  back where they were trying to go after signing in. */
export async function requireUser(returnTo: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(returnTo);
    redirect(`/signin?next=${next}`);
  }
  return user;
}

/** Like requireUser, but also enforces that the user has one of the
 *  allowed roles. Sends them to /portal (with a flash message hint) if
 *  they're signed in but lacking privileges, rather than to /signin. */
export async function requireRole(
  allowedRoles: ReadonlyArray<UserRole>,
  returnTo: string
): Promise<AuthenticatedUser> {
  const user = await requireUser(returnTo);
  if (!allowedRoles.includes(user.role)) {
    redirect('/portal?denied=1');
  }
  return user;
}
