import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPaidSubscribers } from '@/lib/queries/accounts';
import { SubscriberTable } from './subscriber-table';

export const metadata: Metadata = {
  title: 'Subscriber View',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Subscriber View — the active paid subscribers, read straight from the master
 * Account Database (the three paid tiers). A focused, sortable read-only view
 * of the same dataset the Account Database manages.
 */
export default async function SubscribersPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/subscribers'
  );
  const subscribers = await getPaidSubscribers();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Subscriber View"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <div>
        <h2 className="font-headline text-2xl font-bold text-zinc-900">
          {subscribers.length.toLocaleString()} Total Paid Subscriber
          {subscribers.length === 1 ? '' : 's'}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Active paid subscribers from the Account Database. Click any column heading to sort.
        </p>
        <div className="mt-5">
          <SubscriberTable rows={subscribers} />
        </div>
      </div>
    </PortalShell>
  );
}
