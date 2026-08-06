import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole, canManageCredentials } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAdClient } from '@/lib/queries/ad-clients';
import { ClientDetail } from './client-detail';

export const metadata: Metadata = {
  title: 'Client · Ad Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdClientPage({ params }: { params: { id: string } }) {
  const user = await requireRole(['editor', 'admin', 'master admin'], `/portal/all/ads/${params.id}`);
  const result = await getAdClient(params.id);
  if (!result) notFound();
  const { client, files } = result;

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title={client.business_name}
      backLink={{ href: '/portal/all/ads', label: 'Ad Database' }}
      hideTabs
    >
      <ClientDetail client={client} files={files} isAdmin={canManageCredentials(user)} />
    </PortalShell>
  );
}
