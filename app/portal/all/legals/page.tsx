import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getLegalsList, legalPublicUrl, formatLegalDate } from '@/lib/queries/legals';
import { LegalsAdmin } from './legals-admin';

export const metadata: Metadata = {
  title: 'Legals Upload',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PortalLegalsPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/legals'
  );

  const legals = await getLegalsList();
  const rows = legals.map((l) => ({
    id: l.id,
    iso: l.legal_date,
    dateLabel: formatLegalDate(l.legal_date),
    url: legalPublicUrl(l.storage_path),
    fileName: l.file_name,
  }));

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Legals Upload"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <LegalsAdmin legals={rows} />
    </PortalShell>
  );
}
