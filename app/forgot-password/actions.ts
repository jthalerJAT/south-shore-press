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
  const captchaToken =
    String(formData.get('cf-turnstile-response') ?? '').trim() || undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteOrigin()}/auth/callback?next=/reset-password`,
    captchaToken,
  });

  if (error) {
    console.error('[forgotPasswordAction]', error);
    // captcha / rate-limit failures mean NO email went out — telling the
    // user "sent" here strands them (2026-09-30: exactly what happened when
    // the form submitted before Turnstile finished). Neither error reveals
    // whether the address has an account, so surfacing them is safe.
    const code = (error as { code?: string }).code ?? '';
    if (code === 'captcha_failed' || /captcha/i.test(error.message)) {
      return {
        error: 'Human verification did not complete. Please try again.',
        sent: false,
      };
    }
    if (code === 'over_email_send_rate_limit' || error.status === 429) {
      return {
        error: 'Too many attempts — please wait a minute and try again.',
        sent: false,
      };
    }
    // Anything else (e.g. unknown email) still gets the generic success so
    // the form can't be used to probe which emails have accounts.
  }

  // Same response regardless of whether the email matched an account.
  return { error: null, sent: true };
}
