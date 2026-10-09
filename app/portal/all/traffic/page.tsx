import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getTrafficSummary, getTopContent } from '@/lib/queries/traffic';
import { TrafficDashboard } from './traffic-dashboard';

export const metadata: Metadata = {
  title: 'Traffic Stats · Editor Portal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TrafficStatsPage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/traffic');

  const [stats, frames] = await Promise.all([getTrafficSummary(), getTopContent()]);

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Traffic Stats"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <TrafficDashboard stats={stats} frames={frames} />
    </PortalShell>
  );
}
