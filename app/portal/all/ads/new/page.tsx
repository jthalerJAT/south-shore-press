import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { ClientForm } from '../client-form';

export const metadata: Metadata = {
  title: 'Add New Client · Ad Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewAdClientPage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/ads/new');
  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Add New Client"
      backLink={{ href: '/portal/all/ads', label: 'Ad Database' }}
      hideTabs
    >
      <ClientForm />
    </PortalShell>
  );
}
