import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAllCustomerLegals } from '@/lib/queries/customer';
import { LegalDatabaseList } from './legal-database-list';

export const metadata: Metadata = {
  title: 'Legal Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function LegalDatabasePage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/legal-database'
  );
  const legals = await getAllCustomerLegals();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Legal Database"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <LegalDatabaseList legals={legals} />
    </PortalShell>
  );
}
