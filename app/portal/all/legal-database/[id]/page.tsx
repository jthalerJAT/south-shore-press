import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getCustomerLegal } from '@/lib/queries/customer';
import { legalFooterLine, shortLegalDate } from '@/lib/legal-dates';
import { LegalDetailPreview } from './legal-detail-preview';

export const metadata: Metadata = {
  title: 'Legal · Legal Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** The admin read-only view of one customer legal — the same screen the
 *  customer filled out, with every field locked. */
export default async function LegalDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/legal-database/${params.id}`
  );
  const legal = await getCustomerLegal(params.id);
  if (!legal) notFound();

  const footer = legalFooterLine(legal.l_number, legal.run_dates);

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title={`${legal.l_number} — ${legal.customer_name ?? 'Customer legal'}`}
      backLink={{ href: '/portal/all/legal-database', label: 'Legal Database' }}
    >
      <div className="max-w-2xl space-y-5">
        <ReadOnlyField label="Customer" value={legal.customer_name ?? '—'} />
        <ReadOnlyField label="Legal Header" value={legal.header} />
        <div>
          <div className="block text-sm font-medium text-zinc-700">Legal Copy</div>
          <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {legal.body}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <ReadOnlyField label="Start Date" value={shortLegalDate(legal.start_date)} />
          <ReadOnlyField label="End Date" value={shortLegalDate(legal.end_date)} />
        </div>
        <div>
          <div className="block text-sm font-medium text-zinc-700">
            To be included at the end of the legal:
          </div>
          <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-800">
            {footer}
          </div>
        </div>
        <ReadOnlyField
          label="Notarized copy to be mailed"
          value={legal.notary_required ? 'Yes' : 'No'}
        />

        <LegalDetailPreview header={legal.header} body={legal.body} footer={footer} />
      </div>
    </PortalShell>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="block text-sm font-medium text-zinc-700">{label}</div>
      <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
        {value}
      </div>
    </div>
  );
}
