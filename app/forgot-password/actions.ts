'use server';

import { createClient } from '@/lib/supabase/server';
import { getSiteOrigin } from '@/lib/site-url';

export type ForgotPasswordState = {
  error: string | null;
  /** Always set to true on a non-error path, regardless of whether the
   *  email is actually in the system. This avoids leaking which emails
   *  have accounts. */
  sent: boolean;
};

/**
 * Sends a Supabase password-reset email. The reset link lands on
 * /auth/callback which exchanges the code, then routes to /reset-password
 * with an active recovery session so the user can set a new password.
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) {
    return { error: 'Email is required.', sent: false };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    // Log internally but don't surface to the user — generic message.
    console.error('[forgotPasswordAction]', error);
  }

  // Same response regardless of whether the email matched an account.
  return { error: null, sent: true };
}
