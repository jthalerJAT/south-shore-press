'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminEmails } from '@/lib/queries/profiles';
import { sendNotarizedCopyRequestEmail } from '@/lib/email/resend';
import { normalizePhoneForStorage } from '@/lib/phone';

export type RequestState = { error: string | null; success: boolean };

const LEGALS_NOTIFY_EMAIL =
  process.env.LEGALS_NOTIFY_EMAIL ?? 'legals@southshorepress.com';

/**
 * Public "Request Notarized Copy" submission. Saves the request (via the
 * service-role client, since the submitter is unauthenticated) and emails
 * every admin + the legals inbox. The save is authoritative — email is
 * best-effort, so a missing/failed Resend config never loses a request.
 */
export async function requestNotarizedCopyAction(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim() || null;
  const phone = normalizePhoneForStorage(String(formData.get('phone') ?? ''));
  const legalAd = String(formData.get('legal_ad_requested') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const legalIdRaw = String(formData.get('legal_id') ?? '').trim();
  const legal_id = legalIdRaw || null;

  if (!name) return { error: 'Please enter your name.', success: false };
  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address.', success: false };
  }
  if (!legalAd) {
    return { error: 'Please tell us which legal ad you need.', success: false };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error('[requestNotarizedCopyAction] admin client', err);
    return { error: 'Requests are temporarily unavailable. Please try again later.', success: false };
  }

  const { error: insErr } = await admin.from('notarized_copy_requests').insert({
    name,
    address,
    email,
    phone,
    legal_ad_requested: legalAd,
    notes,
    legal_id,
  });
  if (insErr) {
    console.error('[requestNotarizedCopyAction] insert', insErr);
    return { error: 'Could not submit your request. Please try again.', success: false };
  }

  // Best-effort notification — never blocks success.
  try {
    const adminEmails = await getAdminEmails();
    const recipients = Array.from(
      new Set([...adminEmails, LEGALS_NOTIFY_EMAIL])
    ).filter(Boolean);
    await sendNotarizedCopyRequestEmail(
      { name, address, email, phone, legal_ad_requested: legalAd, notes },
      recipients
    );
  } catch (err) {
    console.error('[requestNotarizedCopyAction] email', err);
  }

  return { error: null, success: true };
}
