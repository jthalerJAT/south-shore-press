'use server';

import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type ChangePasswordState = {
  error: string | null;
  success: boolean;
};

/**
 * Change the signed-in user's password. Verifies the current password
 * by attempting a fresh signIn before applying the update — Supabase's
 * native updateUser would otherwise let any session change the password
 * without proving knowledge of the old one (a real concern if a session
 * cookie is borrowed).
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUser('/account/security');

  const currentPassword = String(formData.get('current_password') ?? '');
  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!currentPassword) {
    return { error: 'Current password is required.', success: false };
  }
  if (!newPassword || newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.', success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.', success: false };
  }
  if (newPassword === currentPassword) {
    return { error: 'New password must be different from current password.', success: false };
  }

  const supabase = createClient();

  // Verify current password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    return { error: 'Current password is incorrect.', success: false };
  }

  // Apply the new password.
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    console.error('[changePasswordAction]', updateError);
    return { error: 'Could not update password. Please try again.', success: false };
  }

  return { error: null, success: true };
}
