'use client';

/** A filed legal (customer_legals) on the shared legal record screen. */
import type { CustomerLegal } from '@/lib/queries/customer';
import { LegalRecordView } from '@/components/portal/legal-record-view';
import { quoteLegal, wordCount } from '@/lib/legal-rates';
import { updateAdminLegal, createLegalPaymentLink } from '../actions';

export function LegalDetailView({ legal }: { legal: CustomerLegal }) {
  const quote = quoteLegal({
    words: wordCount(legal.body),
    weeks: legal.run_dates?.length || null,
    header: legal.header,
    body: legal.body,
    customer: legal.customer_name,
    mailedAffidavit: legal.notary_required,
  });

  return (
    <LegalRecordView
      payment={{
        existingUrl: legal.payment_link_url ?? null,
        existingAmountCents: legal.payment_link_amount ?? null,
        suggestedAmountCents: quote ? Math.round(quote.amount * 100) : null,
        onCreate: (amountCents) =>
          createLegalPaymentLink({ id: legal.id, amount_cents: amountCents }),
      }}
      initial={{
        customer: legal.customer_name ?? '',
        contactName: legal.contact_name ?? '',
        contactEmail: legal.contact_email ?? '',
        contactPhone: legal.contact_phone ?? '',
        header: legal.header,
        body: legal.body,
        lNumber: legal.l_number,
        startDate: legal.start_date,
        endDate: legal.end_date,
        affidavit: Boolean(legal.affidavit_required),
        notary: legal.notary_required,
      }}
      onSave={async (v) => {
        if (!v.customer) return { ok: false, error: 'Enter the Customer.' };
        if (!v.lNumber) return { ok: false, error: 'Enter the L#.' };
        if (!v.startDate || !v.endDate)
          return { ok: false, error: 'Select the Start and End Dates.' };
        return updateAdminLegal({
          id: legal.id,
          customer_name: v.customer,
          contact_name: v.contactName,
          contact_email: v.contactEmail,
          contact_phone: v.contactPhone,
          header: v.header,
          body: v.body,
          l_number: v.lNumber,
          start_date: v.startDate,
          end_date: v.endDate,
          affidavit_required: v.affidavit,
          notary_required: v.notary,
        });
      }}
    />
  );
}
