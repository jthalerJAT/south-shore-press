'use server';

import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { addBriefingContact } from '@/lib/constant-contact/client';

export type BriefingSignupInput = {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  confirmEmail: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Register the signed-in reader for the daily email briefing: validate, save
 *  the latest contact details to their profile, then push them onto the
 *  Constant Contact list. */
export async function signUpForBriefings(
  input: BriefingSignupInput
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser('/email-briefings');

  const firstName = (input.firstName ?? '').trim();
  const lastName = (input.lastName ?? '').trim();
  const email = (input.email ?? '').trim();
  const confirmEmail = (input.confirmEmail ?? '').trim();

  if (!firstName || !lastName) return { ok: false, error: 'First and last name are required.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
    return { ok: false, error: 'The email addresses don’t match.' };
  }

  const phone = (input.phone ?? '').trim();
  const street = (input.street ?? '').trim();
  const city = (input.city ?? '').trim();
  const state = (input.state ?? '').trim();
  const zip = (input.zip ?? '').trim();

  // Best-effort: keep the reader's profile in sync with what they entered.
  try {
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        street_address: street || null,
        city: city || null,
        state: state || null,
        zip_code: zip || null,
      })
      .eq('id', user.id);
  } catch {
    // Never block the sign-up on a profile write.
  }

  const res = await addBriefingContact({ email, firstName, lastName, phone, street, city, state, zip });
  if (!res.ok) {
    if (res.error === 'not_configured' || res.error === 'not_connected') {
      return {
        ok: false,
        error:
          'Email briefings aren’t connected yet — please try again shortly. (Site admin: connect Constant Contact in the portal.)',
      };
    }
    return { ok: false, error: 'We couldn’t complete your sign-up just now. Please try again.' };
  }
  return { ok: true };
}
