import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { isSimpleCircConfigured } from '@/lib/simplecirc/client';
import { SubscriberView } from './subscriber-view';

export const metadata: Metadata = {
  title: 'Subscriber View',
  robots: { index: false, follow: false },
};

/**
 * Subscriber View — reproduces SimpleCirc's "Paid Subscribers" export template.
 * The editor presses "Run Template" to pull the list live from SimpleCirc into
 * a sortable table with a running paid count (rather than auto-loading
 * thousands of records on every visit).
 */
export default async function SubscribersPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/subscribers'
  );

  const configured = isSimpleCircConfigured();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Subscriber View"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      {!configured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">SimpleCirc isn’t connected yet.</p>
          <p className="mt-1">
            Set <code className="font-mono">SIMPLECIRC_API_TOKEN</code>,{' '}
            <code className="font-mono">SIMPLECIRC_PUBLICATION_ID</code>, and{' '}
            <code className="font-mono">SIMPLECIRC_POSTAGE_ID</code> in Vercel to load the paid
            subscriber list.
          </p>
        </div>
      ) : (
        <SubscriberView />
      )}
    </PortalShell>
  );
}
