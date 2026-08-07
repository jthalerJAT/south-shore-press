'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, type AuthenticatedUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminEmails } from '@/lib/queries/profiles';
import { sendCustomerLegalEmail } from '@/lib/email/resend';
import { legalNoticeLabel } from '@/lib/newspaper/legal-page';
import { isWednesday, wednesdaysBetween, legalFooterLine } from '@/lib/legal-dates';

/** Legal Portal server actions — customer-facing. */

const MAX_BODY_WORDS = 1000;
const LEGALS_NOTIFY_EMAIL =
  process.env.LEGALS_NOTIFY_EMAIL ?? 'legals@southshorepress.com';

type Result = { ok: boolean; error?: string };

async function requireLegalCustomer(): Promise<
  { user: AuthenticatedUser } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };
  if (!user.customerRoles.includes('legal')) {
    return { error: 'Your account does not have the Legal credential.' };
  }
  return { user };
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

/** Save a new legal: validates, verifies the reserved L# (regenerating on
 *  any collision so no two legals ever share a number), files it in
 *  customer_legals AND the editors' legal_notices library (with the L# +
 *  run-dates line appended, ready to place on a page), then emails the
 *  legals desk. */
export async function saveCustomerLegal(input: {
  header: string;
  body: string;
  l_number: string;
  start_date: string;
  end_date: string;
  notary_required: boolean;
}): Promise<{ ok: boolean; error?: string; l_number?: string }> {
  const ctx = await requireLegalCustomer();
  if ('error' in ctx) return { ok: false, error: ctx.error };
  const { user } = ctx;

  const header = input.header?.trim();
  const body = input.body?.trim();
  if (!header) return { ok: false, error: 'Enter the Legal Header.' };
  if (!body) return { ok: false, error: 'Enter the Legal Copy.' };
  if (wordCount(body) > MAX_BODY_WORDS) {
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

  // The page reserved an L# on load; trust it if it's still free, otherwise
  // (tampering, double submit, races) draw a fresh one from the sequence.
  let lNumber = /^L\d{5,}$/.test(input.l_number ?? '') ? input.l_number : '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!lNumber) {
      const { data: fresh, error: seqErr } = await admin.rpc('next_legal_number');
      if (seqErr || !fresh) {
        console.error('[saveCustomerLegal] next_legal_number', seqErr);
        return { ok: false, error: 'Could not assign a legal number — try again.' };
      }
      lNumber = String(fresh);
    }

    // Customer name comes from the billing profile (fallback: display name).
    const { data: cp } = await admin
      .from('customer_profiles')
      .select('customer_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const customerName =
      (cp as { customer_name?: string | null } | null)?.customer_name ||
      user.displayName ||
      user.email;

    const { error: insErr } = await admin.from('customer_legals').insert({
      user_id: user.id,
      customer_name: customerName,
      header,
      body,
      l_number: lNumber,
      start_date: input.start_date,
      end_date: input.end_date,
      run_dates: runDates,
      notary_required: Boolean(input.notary_required),
    });

    if (insErr) {
      if (insErr.code === '23505') {
        // L# already taken — regenerate and retry.
        lNumber = '';
        continue;
      }
      console.error('[saveCustomerLegal] insert', insErr);
      return { ok: false, error: 'Could not save the legal. Please try again.' };
    }

    // Mirror into the editors' Legal Notices library so the newspaper
    // creator's legal pages can place it directly — with the L# + run-dates
    // line already appended, exactly as it must print.
    const printBody = `${body}\n${legalFooterLine(lNumber, runDates)}`;
    const { error: libErr } = await admin.from('legal_notices').insert({
      label: legalNoticeLabel(`${header} ${body}`),
      header,
      body: printBody,
    });
    if (libErr) console.error('[saveCustomerLegal] legal_notices mirror', libErr);

    // Best-effort email to the legals desk — never blocks success.
    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
        'https://south-shore-press.vercel.app';
      const adminEmails = await getAdminEmails();
      const recipients = Array.from(new Set([...adminEmails, LEGALS_NOTIFY_EMAIL])).filter(Boolean);
      await sendCustomerLegalEmail(
        {
          customerName,
          lNumber,
          legalDatabaseUrl: `${siteUrl}/portal/all/legal-database`,
        },
        recipients
      );
    } catch (err) {
      console.error('[saveCustomerLegal] email', err);
    }

    revalidatePath('/legal-portal');
    revalidatePath('/portal/all/legal-database');
    return { ok: true, l_number: lNumber };
  }

  return { ok: false, error: 'Could not assign a unique legal number — try again.' };
}
