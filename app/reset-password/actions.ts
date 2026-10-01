'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ResetPasswordState = {
  error: string | null;
};

/**
 * Sets a new password. Two entry paths:
 *
 * 1. token_hash (the normal one since 2026-10-01): the reset email links to
 *    /reset-password?token_hash=... and the token is consumed HERE, on
 *    submit — never on page load. Corporate link scanners (Microsoft
 *    Defender Safe Links et al.) prefetch every URL in an email and were
 *    burning Supabase's one-time verify link before the user could click
 *    it ("That link is invalid or expired" within minutes of delivery).
 *    Scanners only issue GETs, so deferring verifyOtp to the form POST
 *    makes the link survive them.
 *
 * 2. Recovery session (legacy emails sent before the template change):
 *    /auth/callback already exchanged the code, so we just update the
 *    password on the current session.
 *
 * After the update we sign out so the recovery session can't be reused,
 * and bounce to /signin.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');
  const tokenHash = String(formData.get('token_hash') ?? '').trim();

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = createClient();

  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });
    if (verifyError) {
      console.error('[resetPasswordAction] verifyOtp', verifyError);
      return {
        error:
          'This reset link has expired or was already used. Please request a new one from the Forgot password page.',
      };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('[resetPasswordAction]', error);
    return { error: 'Could not update password. The link may have expired — try requesting a new one.' };
  }

  // Sign out to invalidate the recovery session, then send to /signin.
  await supabase.auth.signOut();
  redirect('/signin?reset=1');
}
