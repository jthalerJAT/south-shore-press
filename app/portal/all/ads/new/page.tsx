import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { AdForm } from '../ad-form';

export const metadata: Metadata = {
  title: 'New Ad · Ad Database',
  robots: { index: false, follow: false },
};

export default async function NewAdPage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/ads/new');
  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Upload New Ad"
      backLink={{ href: '/portal/all/ads', label: 'Ad Database' }}
    >
      <AdForm mode="create" />
    </PortalShell>
  );
}
