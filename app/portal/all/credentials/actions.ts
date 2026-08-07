'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getCurrentUser,
  canManageCredentials,
  canManageUser,
  canManageRole,
  isMasterAdmin,
  pickHighestRole,
  normalizeRole,
  normalizeCustomerRole,
  type UserRole,
  type CustomerRole,
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

/** How to link a user being granted the Advertiser credential to an Ad
 *  Database client file: pick an existing one, or create a new file. */
export type AdvertiserLink =
  | { clientId: string }
  | { newClientName: string };

export async function setUserRolesAction(
  targetUserId: string,
  newRoles: string[],
  advertiserLink?: AdvertiserLink
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
    .select('id, roles, ad_client_id, display_name')
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

  // Whitelist incoming role values to {admin, editor, journalist}; customer
  // credentials (advertiser / legal) are whitelisted separately — they carry
  // no editorial power and any admin may toggle them.
  const granted = Array.from(
    new Set(
      newRoles
        .map((r) => normalizeRole(r))
        .filter((r): r is UserRole =>
          r !== null && VALID_GRANTABLE_ROLES.includes(r)
        )
    )
  );
  const customerGranted = Array.from(
    new Set(
      newRoles
        .map((r) => normalizeCustomerRole(r))
        .filter((r): r is CustomerRole => r !== null)
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
  // Every account always retains the reader credential — revoking all
  // editorial roles leaves a plain reader row, never a role-less one whose
  // access silently falls back to the legacy column (2026-07-16 policy;
  // the drift that let Bob Chartuk keep publishing). Removal from the
  // system entirely is deleteUserAction, not an empty role set.
  const finalRoles: string[] = [
    ...granted,
    ...customerGranted,
    ...(wasMasterAdmin ? (['master admin'] as UserRole[]) : []),
    'reader',
  ];

  // Sync the legacy single-role column to the highest-privilege EDITORIAL
  // role, which `getCurrentUser` falls back to whenever `roles` is empty (and
  // which v1's RLS still reads). Customer credentials never reach this column
  // — the enum doesn't know them (22P02) and they carry no editorial power.
  // When every editorial role is unchecked this MUST be 'reader' — the
  // no-access baseline (the pre-56fbb0f 'journalist' fallback let
  // de-credentialed users keep publishing).
  const primaryRole: UserRole =
    pickHighestRole(finalRoles.filter((r): r is UserRole => normalizeRole(r) !== null) as UserRole[]) ?? 'reader';

  // "Link User to Advertiser File": when the Advertiser credential is being
  // granted, the account must point at an Ad Database client file so their
  // uploads land in the right place. Accept an existing file or create one.
  let adClientId: string | null = (target as { ad_client_id?: string | null }).ad_client_id ?? null;
  const targetCustomerRoles = (Array.isArray(target.roles) ? target.roles : [])
    .map(normalizeCustomerRole)
    .filter((r): r is CustomerRole => r !== null);
  const gainingAdvertiser =
    customerGranted.includes('advertiser') && !targetCustomerRoles.includes('advertiser');
  if (customerGranted.includes('advertiser') && !adClientId) {
    if (!advertiserLink) {
      if (gainingAdvertiser) {
        return { error: 'Link this user to an Advertiser file first (choose an existing client or create a new one).' };
      }
    } else if ('clientId' in advertiserLink && advertiserLink.clientId) {
      adClientId = advertiserLink.clientId;
    } else if ('newClientName' in advertiserLink && advertiserLink.newClientName.trim()) {
      const admin = createAdminClient();
      const { data: created, error: cErr } = await admin
        .from('ad_clients')
        .insert({ business_name: advertiserLink.newClientName.trim(), created_by: me.id })
        .select('id')
        .single();
      if (cErr || !created) {
        console.error('[setUserRolesAction] create advertiser file', cErr);
        return { error: 'Could not create the new advertiser file.' };
      }
      adClientId = created.id as string;
    } else {
      return { error: 'Choose an advertiser file or enter a name for a new one.' };
    }
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ roles: finalRoles, role: primaryRole, ad_client_id: adClientId })
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

/**
 * Permanently remove an account from the system: deletes the auth user
 * (the profile row cascades — migration 036; their stories survive with
 * author_id cleared to NULL). Same hierarchy rules as role changes:
 * master admin rows and (for regular admins) admin rows are off limits,
 * and nobody can delete themselves.
 */
export async function deleteUserAction(targetUserId: string): Promise<Result> {
  const me = await getCurrentUser();
  if (!me) return { error: 'Not signed in.' };
  if (!canManageCredentials(me)) {
    return { error: 'Only admins can manage credentials.' };
  }
  if (targetUserId === me.id) {
    return { error: 'You cannot delete your own account.' };
  }

  const supabase = createClient();
  const { data: target, error: loadErr } = await supabase
    .from('profiles')
    .select('id, email, roles')
    .eq('id', targetUserId)
    .maybeSingle();
  if (loadErr || !target) {
    return { error: 'Target user not found.' };
  }

  const targetRoles: UserRole[] = (Array.isArray(target.roles) ? target.roles : [])
    .map(normalizeRole)
    .filter((r): r is UserRole => r !== null);
  const targetUserObj = { id: target.id, roles: targetRoles };

  if (!canManageUser(me, targetUserObj)) {
    if (isMasterAdmin(targetUserObj)) {
      return { error: 'Master admin accounts can only be removed via SQL.' };
    }
    return { error: 'Only master admin can delete another admin.' };
  }

  // Deleting the auth user requires the service-role key — the normal
  // cookie-scoped client has no auth-admin powers.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' };
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (delErr) {
    console.error('[deleteUserAction]', { message: delErr.message, targetUserId });
    return { error: delErr.message || 'Failed to delete the account.' };
  }

  // Belt and suspenders: if migration 036's ON DELETE CASCADE isn't applied
  // yet, remove the orphaned profile row directly (service role bypasses RLS).
  const { error: profErr } = await admin.from('profiles').delete().eq('id', targetUserId);
  if (profErr && profErr.code !== 'PGRST116') {
    console.error('[deleteUserAction] profile cleanup', { message: profErr.message, targetUserId });
    return {
      error: `Auth account deleted, but the profile row could not be removed: ${profErr.message}. Run migration 036 and delete the row in Supabase Studio.`,
    };
  }

  revalidatePath('/portal/all/credentials');
  return { error: null };
}
