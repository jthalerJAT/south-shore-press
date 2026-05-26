'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getCurrentUser,
  canManageCredentials,
  pickHighestRole,
  normalizeRole,
  type UserRole,
} from '@/lib/auth';

/**
 * Server Actions for the Credentials page. Admin / master admin only.
 *
 * Guardrails (defense in depth — the RLS policy enforces the same on
 * the DB, but we also catch them here for clearer error messages):
 *   - Caller must be admin or master admin
 *   - You can't modify your own roles (self-lockout prevention)
 *   - 'master admin' can't be granted or revoked via this UI — the
 *     server preserves whatever the target user currently has. Only
 *     way to add/remove master admin is via SQL.
 *   - Only roles in VALID_ROLES below can be granted; anything else
 *     in the input is silently dropped.
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

  // Fetch the target's current roles so we can preserve master admin.
  const { data: target, error: loadErr } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', targetUserId)
    .maybeSingle();
  if (loadErr || !target) {
    return { error: 'Target user not found.' };
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

  // Preserve master admin if the target already had it (the UI never
  // exposes a toggle for master admin, so anything else would be
  // a silent privilege drop).
  const currentRoles = Array.isArray(target.roles) ? target.roles : [];
  const wasMasterAdmin = currentRoles.some(
    (r) => normalizeRole(r) === 'master admin'
  );
  if (wasMasterAdmin) {
    granted.push('master admin');
  }

  // Sync the legacy single-role column to the highest-privilege role.
  // Keeps v1 (still in production at southshorepress.vercel.app)
  // reading what it expects. Falls back to 'journalist' so we never
  // try to write NULL to what might be a NOT NULL column.
  const primaryRole: UserRole = pickHighestRole(granted) ?? 'journalist';

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ roles: granted, role: primaryRole })
    .eq('id', targetUserId);

  if (updErr) {
    console.error('[setUserRolesAction]', {
      message: updErr.message,
      details: updErr.details,
      hint: updErr.hint,
      code: updErr.code,
      targetUserId,
      grantedRoles: granted,
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
