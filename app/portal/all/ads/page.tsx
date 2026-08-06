import type { Metadata } from 'next';
import { requireRole, canManageCredentials } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAdClients } from '@/lib/queries/ad-clients';
import { ClientList } from './client-list';

export const metadata: Metadata = {
  title: 'Ad Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdDatabasePage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/ads');
  const clients = await getAdClients();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Ad Database"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
      hideTabs
    >
      <ClientList clients={clients} isAdmin={canManageCredentials(user)} />
    </PortalShell>
  );
}
