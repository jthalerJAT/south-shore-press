import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side auth helpers. Use from React Server Components, Route
 * Handlers, and Server Actions. The cookie store is read via the
 * @supabase/ssr server client; middleware ensures the cookies are fresh.
 *
 * Role discriminator is `profiles.role` ∈ { 'reader', 'journalist',
 * 'editor', 'admin', 'master admin' } (lowercase strings).
 *
 * 'reader' was added in migration 003 to support public self-signup.
 * Readers have no portal access — they only see /account on the
 * public side of the site.
 */

export type UserRole =
  | 'reader'
  | 'journalist'
  | 'editor'
  | 'admin'
  | 'master admin';

/**
 * CUSTOMER credentials (Ad Portal / Legal Portal). These live in
 * `profiles.roles[]` alongside the editorial roles but are deliberately NOT
 * part of `UserRole`: the legacy `role` enum column doesn't know them, and
 * pickHighestRole / requireRole / RLS must never see them as editorial
 * access. A customer's legacy role stays 'reader'.
 */
export type CustomerRole = 'advertiser' | 'legal';

export function normalizeCustomerRole(raw: unknown): CustomerRole | null {
  const normalized = String(raw ?? '').toLowerCase().replace(/_/g, ' ').trim();
  if (normalized === 'advertiser' || normalized === 'legal') return normalized;
  return null;
}

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
  /** Customer credentials (advertiser / legal) — gate the Ad Portal and
   *  Legal Portal. Independent of the editorial hierarchy. */
  customerRoles: CustomerRole[];
};

/** Priority order for picking the "primary" single role from a roles
 *  array. Earlier entries win. 'reader' is last because it grants no
 *  editorial permissions. */
const ROLE_PRIORITY: ReadonlyArray<UserRole> = [
  'master admin',
  'admin',
  'editor',
  'journalist',
  'reader',
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
    normalized === 'reader' ||
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

export function isMasterAdmin(user: { roles: ReadonlyArray<UserRole> }): boolean {
  return user.roles.includes('master admin');
}

/**
 * Can the viewer modify ANY role for the given target?
 *
 * Hierarchy rules (per spec):
 *   - Master admin can manage any user EXCEPT another master admin
 *     (master admin status is only changeable via SQL)
 *   - Admin can manage editors and journalists only — NOT other
 *     admins, NOT master admins
 *   - Nobody can edit their own row (self-lockout protection)
 *   - Editor / journalist viewers don't get here at all (page gate)
 */
export function canManageUser(
  viewer: { id: string; roles: ReadonlyArray<UserRole> },
  target: { id: string; roles: ReadonlyArray<UserRole> }
): boolean {
  if (target.id === viewer.id) return false;
  if (!canManageCredentials(viewer)) return false;

  // Master admin status only changes via SQL — nobody touches it here.
  if (isMasterAdmin(target)) return false;

  // Only master admin can manage other admins.
  const targetIsAdmin = target.roles.includes('admin');
  if (targetIsAdmin && !isMasterAdmin(viewer)) return false;

  return true;
}

/**
 * Can the viewer toggle THIS specific role on THIS target user?
 *
 * Additional constraint on top of canManageUser:
 *   - Only master admin can grant or revoke the Admin role.
 *     (A regular admin can manage Editor/Journalist roles for
 *     non-admin users, but never the Admin checkbox itself.)
 *   - 'reader' is not a checkbox on the Credentials page — it's the
 *     default tier for self-signed-up users, managed via /signup, not
 *     by admins. The check here returns false defensively.
 */
export function canManageRole(
  viewer: { id: string; roles: ReadonlyArray<UserRole> },
  target: { id: string; roles: ReadonlyArray<UserRole> },
  role: UserRole
): boolean {
  if (!canManageUser(viewer, target)) return false;
  if (role === 'admin' && !isMasterAdmin(viewer)) return false;
  // We never offer the 'master admin' role via UI — extra belt for safety.
  if (role === 'master admin') return false;
  // 'reader' is not user-toggleable from the Credentials page.
  if (role === 'reader') return false;
  return true;
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

  const customerRoles: CustomerRole[] = Array.from(
    new Set(
      rawArray
        .map(normalizeCustomerRole)
        .filter((r): r is CustomerRole => r !== null)
    )
  );

  if (roles.length === 0) {
    const single = normalizeRole(profile.role);
    if (single) roles = [single];
  }

  // Default single-role view: highest-priv role from the set, or
  // 'reader' as the safe baseline so a misconfigured profile can't
  // accidentally grant editorial access.
  const role = pickHighestRole(roles) ?? 'reader';

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role,
    roles,
    customerRoles,
  };
}

/** Gate a customer portal: signed-in AND holding the given customer
 *  credential. Readers without it land on /account. */
export async function requireCustomerRole(
  kind: CustomerRole,
  returnTo: string
): Promise<AuthenticatedUser> {
  const user = await requireUser(returnTo);
  if (!user.customerRoles.includes(kind)) {
    redirect('/account?denied=1');
  }
  return user;
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
