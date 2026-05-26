'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ResetPasswordState = {
  error: string | null;
};

/**
 * Sets a new password for the user in the current (recovery) session.
 * The session was established by /auth/callback exchanging the code
 * from the reset email. After the password update, we sign the user
 * out so the recovery session can't be reused and bounce them to
 * /signin to log in fresh.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('[resetPasswordAction]', error);
    return { error: 'Could not update password. The link may have expired — try requesting a new one.' };
  }

  // Sign out to invalidate the recovery session, then send to /signin.
  await supabase.auth.signOut();
  redirect('/signin?reset=1');
}
