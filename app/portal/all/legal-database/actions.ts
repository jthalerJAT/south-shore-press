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
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  header: string;
  body: string;
  l_number: string;
  start_date: string;
  end_date: string;
  affidavit_required: boolean;
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

  // A typed L# is intentional (entering an existing legal under its original
  // number) — a collision on it must surface as an error, never be silently
  // renumbered. Only an absent/invalid L# draws fresh numbers from the
  // sequence, with retries on collision.
  const typedLNumber = /^L\d{5,}$/.test((input.l_number ?? '').trim())
    ? input.l_number.trim()
    : '';
  let lNumber = typedLNumber;
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
        contact_name: input.contact_name?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        header,
        body,
        l_number: lNumber,
        start_date: input.start_date,
        end_date: input.end_date,
        run_dates: runDates,
        affidavit_required: Boolean(input.affidavit_required) || Boolean(input.notary_required),
        notary_required: Boolean(input.notary_required),
      })
      .select('id')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        if (typedLNumber) {
          return { ok: false, error: `${typedLNumber} is already used by another legal.` };
        }
        // Auto-drawn L# collided — regenerate and retry.
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

/** Edit an existing legal in place — everything is editable, including the
 *  L# (entering legals that already ran elsewhere keeps their numbers). The
 *  Legal Notices library mirror is updated to match, so the newspaper
 *  creator always places the current version. */
export async function updateAdminLegal(input: {
  id: string;
  customer_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  header: string;
  body: string;
  l_number: string;
  start_date: string;
  end_date: string;
  affidavit_required: boolean;
  notary_required: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!['editor', 'admin', 'master admin'].includes(user.role)) {
    return { ok: false, error: 'Your account cannot edit legals.' };
  }

  const customerName = input.customer_name?.trim();
  const header = input.header?.trim();
  const body = input.body?.trim();
  const lNumber = (input.l_number ?? '').trim().toUpperCase();
  if (!customerName) return { ok: false, error: 'Enter the Customer.' };
  if (!header) return { ok: false, error: 'Enter the Legal Header.' };
  if (!body) return { ok: false, error: 'Enter the Legal Copy.' };
  if (body.split(/\s+/).length > MAX_BODY_WORDS) {
    return { ok: false, error: `Legal Copy is limited to ${MAX_BODY_WORDS} words.` };
  }
  if (!/^L\d{5,}$/.test(lNumber)) {
    return { ok: false, error: 'The L# must be an L followed by at least 5 digits (e.g. L40001).' };
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
  const { data: existing } = await admin
    .from('customer_legals')
    .select('*')
    .eq('id', input.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Legal not found.' };

  const { error: updErr } = await admin
    .from('customer_legals')
    .update({
      customer_name: customerName,
      contact_name: input.contact_name?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      header,
      body,
      l_number: lNumber,
      start_date: input.start_date,
      end_date: input.end_date,
      run_dates: runDates,
      affidavit_required: Boolean(input.affidavit_required) || Boolean(input.notary_required),
        notary_required: Boolean(input.notary_required),
    })
    .eq('id', input.id);
  if (updErr) {
    if (updErr.code === '23505') {
      return { ok: false, error: `${lNumber} is already used by another legal.` };
    }
    console.error('[updateAdminLegal] update', updErr);
    return { ok: false, error: 'Could not save the changes. Please try again.' };
  }

  // Keep the Legal Notices library in step: update the mirror row created
  // when this legal was filed (matched by its old print text); if it was
  // edited or removed there, file a fresh current copy instead.
  const old = existing as {
    header: string;
    body: string;
    l_number: string;
    run_dates: string[];
  };
  const oldPrint = `${old.body}\n${legalFooterLine(old.l_number, old.run_dates ?? [])}`;
  const newPrint = `${body}\n${legalFooterLine(lNumber, runDates)}`;
  const label = legalNoticeLabel(`${header} ${body}`);
  const { data: mirror } = await admin
    .from('legal_notices')
    .select('id')
    .eq('header', old.header)
    .eq('body', oldPrint)
    .limit(1)
    .maybeSingle();
  if (mirror) {
    const { error: mErr } = await admin
      .from('legal_notices')
      .update({ label, header, body: newPrint })
      .eq('id', (mirror as { id: string }).id);
    if (mErr) console.error('[updateAdminLegal] mirror update', mErr);
  } else {
    const { error: mErr } = await admin
      .from('legal_notices')
      .insert({ label, header, body: newPrint });
    if (mErr) console.error('[updateAdminLegal] mirror insert', mErr);
  }

  revalidatePath('/portal/all/legal-database');
  revalidatePath(`/portal/all/legal-database/${input.id}`);
  return { ok: true };
}

/** Save a Legal Notices LIBRARY entry edited through the Legal Database's
 *  record screen (same fields as a filed legal). When the record is complete
 *  — customer, valid L#, Wednesday run dates — it is PROMOTED to a full
 *  customer_legals row (so every field persists) and the library copy is
 *  updated to match. Otherwise only the library text (header + copy + footer
 *  line) is saved and the extra fields stay blank. */
export async function saveLibraryNotice(input: {
  id: string;
  customer_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  header: string;
  body: string; // copy WITHOUT the footer line
  l_number: string;
  start_date: string; // ISO or ''
  end_date: string; // ISO or ''
  affidavit_required: boolean;
  notary_required: boolean;
}): Promise<{ ok: boolean; error?: string; promotedId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!['editor', 'admin', 'master admin'].includes(user.role)) {
    return { ok: false, error: 'Your account cannot edit legals.' };
  }

  const customerName = input.customer_name?.trim() ?? '';
  const header = input.header?.trim();
  const body = input.body?.trim();
  const lNumber = (input.l_number ?? '').trim().toUpperCase();
  if (!header) return { ok: false, error: 'Enter the Legal Header.' };
  if (!body) return { ok: false, error: 'Enter the Legal Copy.' };
  if (body.split(/\s+/).length > MAX_BODY_WORDS) {
    return { ok: false, error: `Legal Copy is limited to ${MAX_BODY_WORDS} words.` };
  }
  if (lNumber && !/^L\d{5,}$/.test(lNumber)) {
    return { ok: false, error: 'The L# must be an L followed by at least 5 digits (e.g. L40001).' };
  }

  const hasDates =
    /^\d{4}-\d{2}-\d{2}$/.test(input.start_date) && /^\d{4}-\d{2}-\d{2}$/.test(input.end_date);
  const runDates = hasDates ? wednesdaysBetween(input.start_date, input.end_date) : [];
  const footer = lNumber && runDates.length ? legalFooterLine(lNumber, runDates) : lNumber;
  const printBody = footer ? `${body}\n${footer}` : body;
  const label = legalNoticeLabel(`${header} ${body}`);

  const admin = createAdminClient();

  // Complete record → promote into customer_legals so Customer, dates and
  // notary actually persist.
  if (customerName && lNumber && hasDates) {
    if (!isWednesday(input.start_date) || !isWednesday(input.end_date)) {
      return { ok: false, error: 'Run dates must be Wednesdays — the paper runs on Wednesdays.' };
    }
    if (input.end_date < input.start_date) {
      return { ok: false, error: 'End Date must be on or after Start Date.' };
    }
    const { data: inserted, error: insErr } = await admin
      .from('customer_legals')
      .insert({
        user_id: user.id,
        customer_name: customerName,
        contact_name: input.contact_name?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        header,
        body,
        l_number: lNumber,
        start_date: input.start_date,
        end_date: input.end_date,
        run_dates: runDates,
        affidavit_required: Boolean(input.affidavit_required) || Boolean(input.notary_required),
        notary_required: Boolean(input.notary_required),
      })
      .select('id')
      .single();
    if (insErr) {
      if (insErr.code === '23505') {
        return { ok: false, error: `${lNumber} is already used by another legal.` };
      }
      console.error('[saveLibraryNotice] promote', insErr);
      return { ok: false, error: 'Could not save the legal. Please try again.' };
    }
    const { error: mErr } = await admin
      .from('legal_notices')
      .update({ header, body: printBody, label })
      .eq('id', input.id);
    if (mErr) console.error('[saveLibraryNotice] mirror update', mErr);

    revalidatePath('/portal/all/legal-database');
    return { ok: true, promotedId: (inserted as { id: string }).id };
  }

  // Incomplete record → save the library text; blank fields stay blank.
  const { error } = await admin
    .from('legal_notices')
    .update({ header, body: printBody, label })
    .eq('id', input.id);
  if (error) {
    console.error('[saveLibraryNotice]', error);
    return { ok: false, error: 'Could not save the changes. Please try again.' };
  }

  revalidatePath('/portal/all/legal-database');
  revalidatePath(`/portal/all/legal-database/notice/${input.id}`);
  return { ok: true };
}
