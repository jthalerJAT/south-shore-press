'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getCurrentUser,
  canManageCredentials,
  canManageUser,
  canManageRole,
  isMasterAdmin,
  pickHighestRole,
  normalizeRole,
  type UserRole,
} from '@/lib/auth';

/**
 * Server Actions for the Credentials page. Admin / master admin only.
 *
 * Tier rules (mirror the UI; both layers enforce):
 *   - Master admin can manage any user except another master admin
 *     (master admin status is only changeable via SQL)
 *   - Regular admin can manage editors and journalists, but NOT
 *     other admins or master admins
 *   - Only master admin can grant or revoke the Admin role itself
 *   - Nobody can edit their own row (self-lockout)
 *   - 'master admin' role is never grantable via this UI; the server
 *     preserves whatever the target currently has so the toggle UI
 *     never accidentally drops master-admin status
 */

const VALID_GRANTABLE_ROLES: ReadonlyArray<UserRole> = [
  'admin',
  'editor',
  'journalist',
];

type Result = { error: string | null };

export async function setUserRolesAction(
  targetUserId: string,
  newRoles: string[]
): Promise<Result> {
  const me = await getCurrentUser();
  if (!me) return { error: 'Not signed in.' };
  if (!canManageCredentials(me)) {
    return { error: 'Only admins can manage credentials.' };
  }
  if (targetUserId === me.id) {
    return { error: 'You cannot modify your own roles here.' };
  }

  const supabase = createClient();

  // Fetch the target's current roles so we can:
  //   - run hierarchy checks (canManageUser / canManageRole)
  //   - preserve master admin
  //   - diff what's actually changing for per-role permission checks
  const { data: target, error: loadErr } = await supabase
    .from('profiles')
    .select('id, roles')
    .eq('id', targetUserId)
    .maybeSingle();
  if (loadErr || !target) {
    return { error: 'Target user not found.' };
  }

  const targetCurrentRoles: UserRole[] = (Array.isArray(target.roles)
    ? target.roles
    : []
  )
    .map(normalizeRole)
    .filter((r): r is UserRole => r !== null);

  const targetUserObj = { id: target.id, roles: targetCurrentRoles };

  // Hierarchy gate: can `me` manage this target at all?
  if (!canManageUser(me, targetUserObj)) {
    if (isMasterAdmin(targetUserObj)) {
      return { error: 'Master admin can only be modified via SQL.' };
    }
    return { error: 'Only master admin can modify another admin.' };
  }

  // Whitelist incoming role values to {admin, editor, journalist}.
  const granted = Array.from(
    new Set(
      newRoles
        .map((r) => normalizeRole(r))
        .filter((r): r is UserRole =>
          r !== null && VALID_GRANTABLE_ROLES.includes(r)
        )
    )
  );

  // Per-role check: for every role that's being ADDED or REMOVED,
  // confirm the viewer has permission to toggle that specific role
  // on this specific target. Stops a regular admin from sneaking
  // the Admin role onto another user via direct action call.
  for (const role of VALID_GRANTABLE_ROLES) {
    const had = targetCurrentRoles.includes(role);
    const will = granted.includes(role);
    if (had === will) continue; // no change to this role
    if (!canManageRole(me, targetUserObj, role)) {
      return {
        error: `Only master admin can ${
          will ? 'grant' : 'revoke'
        } the ${role} role.`,
      };
    }
  }

  // Preserve master admin if the target already had it (the UI never
  // exposes a toggle for master admin; this guards against any
  // direct-API path that omits it).
  const wasMasterAdmin = isMasterAdmin(targetUserObj);
  const finalRoles: UserRole[] = wasMasterAdmin
    ? [...granted, 'master admin']
    : granted;

  // Sync the legacy single-role column to the highest-privilege role, which
  // `getCurrentUser` falls back to whenever `roles` is empty (and which v1's
  // RLS still reads). When every role is unchecked the user has NO editorial
  // credentials, so this MUST be 'reader' — the no-access baseline. It used to
  // fall back to 'journalist' (only to avoid writing NULL into a possibly
  // NOT NULL column), which silently demoted de-credentialed users to
  // journalist instead of revoking them — and journalists may publish their
  // own stories, so they kept publishing. 'reader' has no portal access.
  const primaryRole: UserRole = pickHighestRole(finalRoles) ?? 'reader';

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ roles: finalRoles, role: primaryRole })
    .eq('id', targetUserId);

  if (updErr) {
    console.error('[setUserRolesAction]', {
      message: updErr.message,
      details: updErr.details,
      hint: updErr.hint,
      code: updErr.code,
      targetUserId,
      grantedRoles: finalRoles,
    });
    return {
      error:
        [updErr.message, updErr.details, updErr.hint]
          .filter(Boolean)
          .join(' — ') || 'Failed to update roles.',
    };
  }

  revalidatePath('/portal/all/credentials');
  return { error: null };
}
