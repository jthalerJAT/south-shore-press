import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAds } from '@/lib/queries/ads';
import { AdList } from './ad-list';

export const metadata: Metadata = {
  title: 'Ad Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdDatabasePage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/ads');
  const ads = await getAds();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Ad Database"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <AdList ads={ads} />
    </PortalShell>
  );
}
