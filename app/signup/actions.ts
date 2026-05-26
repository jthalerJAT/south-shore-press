'use server';

import { createClient } from '@/lib/supabase/server';
import { getSiteOrigin } from '@/lib/site-url';
import { normalizePhoneForStorage } from '@/lib/phone';

export type SignUpState = {
  error: string | null;
  /** Set to true on success. The form switches to a "check your email"
   *  confirmation screen since Supabase email confirmation is required
   *  before the user can sign in. */
  success: boolean;
};

/**
 * Reader signup. Creates the Supabase auth row + sends the confirmation
 * email. The profile row is created automatically by the
 * on_auth_user_created trigger (see migration 003), which reads
 * raw_user_meta_data to populate first/last/phone/address.
 *
 * Email confirmation is required (configured in Supabase Auth settings),
 * so the user is NOT auto-signed-in here — they click the link in the
 * email and then sign in via /signin.
 */
export async function signUpAction(
  _prev: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = normalizePhoneForStorage(String(formData.get('phone') ?? ''));
  const streetAddress = String(formData.get('street_address') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const zipCode = String(formData.get('zip_code') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  // Validation
  if (!firstName || !lastName) {
    return { error: 'First and last name are required.', success: false };
  }
  if (!email) {
    return { error: 'Email is required.', success: false };
  }
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.', success: false };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.', success: false };
  }

  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Sent to the trigger via raw_user_meta_data → mirrored into profiles.
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        street_address: streetAddress || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
      },
      // Where Supabase sends them after they click the confirm link.
      // Routes through /auth/callback to exchange the code for a session,
      // then forwards them to /signin with a confirmed flag so the form
      // can show a "your account is confirmed — sign in" banner. The
      // inner path is encoded so the `?` doesn't break URL parsing
      // upstream when Supabase rewrites the link.
      emailRedirectTo: `${getSiteOrigin()}/auth/callback?next=${encodeURIComponent('/signin?confirmed=1')}`,
    },
  });

  if (error) {
    // Supabase returns "User already registered" verbatim — pass through
    // so the user understands what happened, but don't leak whether the
    // email is otherwise valid.
    if (error.message.toLowerCase().includes('already registered')) {
      return {
        error: 'An account with this email already exists. Try signing in.',
        success: false,
      };
    }
    console.error('[signUpAction]', error);
    return { error: 'Could not create account. Please try again.', success: false };
  }

  return { error: null, success: true };
}
