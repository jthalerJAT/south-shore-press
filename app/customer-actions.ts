'use server';

import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhoneForStorage } from '@/lib/phone';

/** Shared customer-portal action: save the Billing Information profile.
 *  Available to any signed-in user holding a customer credential. */
export async function saveCustomerProfileAction(input: {
  customer_name?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.customerRoles.length === 0) {
    return { ok: false, error: 'Your account has no customer credential.' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('customer_profiles').upsert({
    user_id: user.id,
    customer_name: input.customer_name?.trim() || null,
    contact_name: input.contact_name?.trim() || null,
    contact_phone: normalizePhoneForStorage(input.contact_phone ?? '') || null,
    contact_email: input.contact_email?.trim() || null,
    street: input.street?.trim() || null,
    street2: input.street2?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    zip: input.zip?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[saveCustomerProfileAction]', error);
    return { ok: false, error: 'Could not save your profile.' };
  }
  return { ok: true };
}
