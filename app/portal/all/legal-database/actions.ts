'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { legalNoticeLabel } from '@/lib/newspaper/legal-page';
import { isWednesday, wednesdaysBetween, legalFooterLine } from '@/lib/legal-dates';

/**
 * Legal Database server actions — staff-facing. Mirrors the customer
 * saveCustomerLegal flow (same validation, same L# collision retry, same
 * legal_notices mirror) but is gated on editor+ roles, takes the customer
 * name as a typed field, and skips the legals-desk notification email —
 * the person entering it IS the legals desk.
 */

const MAX_BODY_WORDS = 1000;

export async function saveAdminLegal(input: {
  customer_name: string;
  header: string;
  body: string;
  l_number: string;
  start_date: string;
  end_date: string;
  notary_required: boolean;
}): Promise<{ ok: boolean; error?: string; l_number?: string; id?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!['editor', 'admin', 'master admin'].includes(user.role)) {
    return { ok: false, error: 'Your account cannot create legals.' };
  }

  const customerName = input.customer_name?.trim();
  const header = input.header?.trim();
  const body = input.body?.trim();
  if (!customerName) return { ok: false, error: 'Enter the Customer.' };
  if (!header) return { ok: false, error: 'Enter the Legal Header.' };
  if (!body) return { ok: false, error: 'Enter the Legal Copy.' };
  const words = body.split(/\s+/).length;
  if (words > MAX_BODY_WORDS) {
    return { ok: false, error: `Legal Copy is limited to ${MAX_BODY_WORDS} words.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end_date)) {
    return { ok: false, error: 'Select a Start Date and an End Date.' };
  }
  if (!isWednesday(input.start_date) || !isWednesday(input.end_date)) {
    return { ok: false, error: 'Run dates must be Wednesdays — the paper runs on Wednesdays.' };
  }
  if (input.end_date < input.start_date) {
    return { ok: false, error: 'End Date must be on or after Start Date.' };
  }
  const runDates = wednesdaysBetween(input.start_date, input.end_date);

  const admin = createAdminClient();

  let lNumber = /^L\d{5,}$/.test(input.l_number ?? '') ? input.l_number : '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!lNumber) {
      const { data: fresh, error: seqErr } = await admin.rpc('next_legal_number');
      if (seqErr || !fresh) {
        console.error('[saveAdminLegal] next_legal_number', seqErr);
        return { ok: false, error: 'Could not assign a legal number — try again.' };
      }
      lNumber = String(fresh);
    }

    const { data: inserted, error: insErr } = await admin
      .from('customer_legals')
      .insert({
        user_id: user.id,
        customer_name: customerName,
        header,
        body,
        l_number: lNumber,
        start_date: input.start_date,
        end_date: input.end_date,
        run_dates: runDates,
        notary_required: Boolean(input.notary_required),
      })
      .select('id')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        // L# already taken — regenerate and retry.
        lNumber = '';
        continue;
      }
      console.error('[saveAdminLegal] insert', insErr);
      return { ok: false, error: 'Could not save the legal. Please try again.' };
    }

    // Mirror into the editors' Legal Notices library so the newspaper
    // creator's legal pages can place it directly.
    const printBody = `${body}\n${legalFooterLine(lNumber, runDates)}`;
    const { error: libErr } = await admin.from('legal_notices').insert({
      label: legalNoticeLabel(`${header} ${body}`),
      header,
      body: printBody,
    });
    if (libErr) console.error('[saveAdminLegal] legal_notices mirror', libErr);

    revalidatePath('/portal/all/legal-database');
    return { ok: true, l_number: lNumber, id: (inserted as { id: string }).id };
  }

  return { ok: false, error: 'Could not assign a unique legal number — try again.' };
}
