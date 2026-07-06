import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { listPaidSubscribers } from '@/lib/simplecirc/client';
import { SubscriberTable } from './subscriber-table';

export const metadata: Metadata = {
  title: 'Subscriber View',
  robots: { index: false, follow: false },
};

// Always pulled fresh from SimpleCirc on load (behind editor-tier auth).
export const dynamic = 'force-dynamic';

/**
 * Subscriber View — the active paid subscriber list pulled live from SimpleCirc
 * (the system of record for print distribution). Sortable table with a running
 * count so the total paid-subscriber number is visible at a glance.
 */
export default async function SubscribersPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/subscribers'
  );

  const result = await listPaidSubscribers();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Subscriber View"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      {!result.configured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">SimpleCirc isn’t connected yet.</p>
          <p className="mt-1">
            Set <code className="font-mono">SIMPLECIRC_API_TOKEN</code>,{' '}
            <code className="font-mono">SIMPLECIRC_PUBLICATION_ID</code>, and{' '}
            <code className="font-mono">SIMPLECIRC_POSTAGE_ID</code> in Vercel to load the paid
            subscriber list.
          </p>
        </div>
      ) : result.error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-800">
          {result.error} Please try again in a moment.
        </div>
      ) : (
        <div>
          <h2 className="font-headline text-2xl font-bold text-zinc-900">
            {result.rows.length.toLocaleString()} Total Paid Subscriber
            {result.rows.length === 1 ? '' : 's'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Active paid subscribers, pulled live from SimpleCirc. Click any column heading to sort.
          </p>

          <div className="mt-5">
            <SubscriberTable rows={result.rows} />
          </div>

          {result.rows.length === 0 && result.rawSample ? (
            <div className="mt-6 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-700">
                Connected to SimpleCirc, but no rows matched the expected fields.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Below is one raw record exactly as SimpleCirc returned it. Send this to your
                developer to lock the column mapping (names like first/last, address, subscription
                term, and last payment can vary by account).
              </p>
              <pre className="mt-3 max-h-96 overflow-auto rounded bg-white p-3 text-[11px] leading-relaxed text-zinc-700 border border-zinc-200">
                {JSON.stringify(result.rawSample, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </PortalShell>
  );
}
