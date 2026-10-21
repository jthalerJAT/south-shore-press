'use client';

/** A filed legal (customer_legals) on the shared legal record screen. */
import type { CustomerLegal } from '@/lib/queries/customer';
import { LegalRecordView } from '@/components/portal/legal-record-view';
import { updateAdminLegal } from '../actions';

export function LegalDetailView({ legal }: { legal: CustomerLegal }) {
  return (
    <LegalRecordView
      initial={{
        customer: legal.customer_name ?? '',
        header: legal.header,
        body: legal.body,
        lNumber: legal.l_number,
        startDate: legal.start_date,
        endDate: legal.end_date,
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
          header: v.header,
          body: v.body,
          l_number: v.lNumber,
          start_date: v.startDate,
          end_date: v.endDate,
          notary_required: v.notary,
        });
      }}
    />
  );
}
