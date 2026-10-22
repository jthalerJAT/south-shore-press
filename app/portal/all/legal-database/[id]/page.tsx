import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getCustomerLegal } from '@/lib/queries/customer';
import { LegalDetailView } from './legal-detail-view';

export const metadata: Metadata = {
  title: 'Legal - Legal Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** One customer legal - read-only until Edit Legal unlocks the fields. */
export default async function LegalDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/legal-database/${params.id}`
  );
  const legal = await getCustomerLegal(params.id);
  if (!legal) notFound();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title={`${legal.l_number} - ${legal.customer_name ?? 'Customer legal'}`}
      backLink={{ href: '/portal/all/legal-database', label: 'Legal Database' }}
    >
      <LegalDetailView legal={legal} />
    </PortalShell>
  );
}
