'use client';

/**
 * A Legal Notices LIBRARY entry on the shared legal record screen — same
 * fields as a filed legal. The L# and run dates are parsed out of the stored
 * print copy where possible; fields with nothing on file start blank.
 * Saving with Customer + L# + run dates all filled promotes the notice to a
 * full filed legal; otherwise just the library text is updated.
 */
import type { LegalNotice } from '@/lib/queries/legal-notices';
import { parseLegalPrint } from '@/lib/legal-dates';
import { LegalRecordView } from '@/components/portal/legal-record-view';
import { saveLibraryNotice } from '../../actions';

export function NoticeDetailView({ notice }: { notice: LegalNotice }) {
  const parsed = parseLegalPrint(notice.body);

  return (
    <LegalRecordView
      initial={{
        customer: '',
        header: notice.header ?? 'PUBLIC NOTICE',
        body: parsed.copy,
        lNumber: parsed.lNumber,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        affidavit: false,
        notary: false,
      }}
      note="This legal lives in the Legal Notices library the newspaper creator places from. Blank fields aren't on file for it — fill in the Customer (and dates, if missing) and save to file it as a full legal record."
      onSave={async (v) => {
        const res = await saveLibraryNotice({
          id: notice.id,
          customer_name: v.customer,
          header: v.header,
          body: v.body,
          l_number: v.lNumber,
          start_date: v.startDate,
          end_date: v.endDate,
          affidavit_required: v.affidavit,
          notary_required: v.notary,
        });
        if (res.ok && res.promotedId) {
          return { ok: true, redirectTo: `/portal/all/legal-database/${res.promotedId}` };
        }
        return res;
      }}
    />
  );
}
