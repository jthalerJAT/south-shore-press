'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { titleCase, normalizeState, formatPhone, normalizeZip } from '@/lib/format';

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

  // Normalize to the standard mailing-label format on the way in.
  const firstName = titleCase(String(formData.get('first_name') ?? ''));
  const lastName = titleCase(String(formData.get('last_name') ?? ''));
  const phone = formatPhone(String(formData.get('phone') ?? ''));
  const streetAddress = titleCase(String(formData.get('street_address') ?? ''));
  const city = titleCase(String(formData.get('city') ?? ''));
  const state = normalizeState(String(formData.get('state') ?? ''));
  const zipCode = normalizeZip(String(formData.get('zip_code') ?? ''));

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
      phone: phone,
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

  // Mirror the same edit onto the master Account Database record (the single
  // source of truth for customer info). Uses the service-role client because
  // `accounts` is admin-RLS; the user is already authenticated above and we
  // scope the write to their own row (user_id = user.id) and contact columns
  // only (never account_type / status / payment).
  try {
    const admin = createAdminClient();
    await admin
      .from('accounts')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        address_1: streetAddress || null,
        city: city || null,
        state: state || null,
        zip: zipCode || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
  } catch (e) {
    // Non-fatal: the profile write already succeeded. Log for follow-up.
    console.error('[updateProfileAction] account sync', e);
  }

  // Revalidate the layout so the header chip + account header reflect
  // the new name on the next render, plus the admin surfaces that render the
  // same master record so a self-edit shows up there immediately.
  revalidatePath('/', 'layout');
  revalidatePath('/account');
  revalidatePath('/portal/all/accounts');
  revalidatePath('/portal/all/subscribers');
  return { error: null, success: true };
}
