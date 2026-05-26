'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type ProfileUpdateState = {
  error: string | null;
  success: boolean;
};

/**
 * Update the signed-in user's profile fields. RLS limits the row to
 * their own; this server action additionally limits the COLUMNS to
 * non-privileged ones (no role/roles, no stripe_*, no subscription_*)
 * even though RLS doesn't enforce per-column gates.
 */
export async function updateProfileAction(
  _prev: ProfileUpdateState,
  formData: FormData
): Promise<ProfileUpdateState> {
  const user = await requireUser('/account');

  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const streetAddress = String(formData.get('street_address') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const zipCode = String(formData.get('zip_code') ?? '').trim();

  if (!firstName || !lastName) {
    return { error: 'First and last name are required.', success: false };
  }

  const displayName = `${firstName} ${lastName}`.trim();

  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      street_address: streetAddress || null,
      city: city || null,
      state: state || null,
      zip_code: zipCode || null,
      display_name: displayName,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[updateProfileAction]', error);
    return { error: 'Could not update profile. Please try again.', success: false };
  }

  // Revalidate the layout so the header chip + account header reflect
  // the new name on the next render.
  revalidatePath('/', 'layout');
  revalidatePath('/account');
  return { error: null, success: true };
}
