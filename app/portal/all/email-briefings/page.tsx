import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { isConstantContactConfigured, isConstantContactConnected } from '@/lib/constant-contact/client';

export const metadata: Metadata = {
  title: 'Email Briefings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EmailBriefingsAdminPage({
  searchParams,
}: {
  searchParams: { cc?: string };
}) {
  const user = await requireRole(['admin', 'master admin'], '/portal/all/email-briefings');
  const configured = isConstantContactConfigured();
  const connected = configured ? await isConstantContactConnected() : false;

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Email Briefings"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      {searchParams.cc === 'connected' ? (
        <div role="status" className="mb-5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-4 py-3">
          ✓ Constant Contact connected.
        </div>
      ) : null}
      {searchParams.cc === 'error' ? (
        <div role="alert" className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">
          Couldn’t connect — check the app credentials + redirect URI and try again.
        </div>
      ) : null}

      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-zinc-600">
          Sign-ups on the public{' '}
          <Link href="/email-briefings" className="text-brand-red hover:underline">Email Briefings</Link>{' '}
          page are pushed to your Constant Contact list. Manage that connection here.
        </p>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Status</div>
              <div className="mt-1 text-lg font-semibold">
                {!configured ? (
                  <span className="text-zinc-700">Not configured</span>
                ) : connected ? (
                  <span className="text-emerald-700">Connected ✓</span>
                ) : (
                  <span className="text-amber-700">Not connected</span>
                )}
              </div>
            </div>
            {configured ? (
              <a
                href="/api/constant-contact/connect"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
              >
                {connected ? 'Reconnect' : 'Connect Constant Contact'}
              </a>
            ) : null}
          </div>

          {!configured ? (
            <p className="mt-4 text-sm text-zinc-600">
              Add <code className="text-xs">CONSTANT_CONTACT_CLIENT_ID</code>,{' '}
              <code className="text-xs">CONSTANT_CONTACT_CLIENT_SECRET</code> and{' '}
              <code className="text-xs">CONSTANT_CONTACT_LIST_ID</code> in Vercel, redeploy, then connect here.
            </p>
          ) : connected ? (
            <p className="mt-4 text-sm text-zinc-600">
              New sign-ups are flowing to your configured list.{' '}
              <a href="/api/constant-contact/lists" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                View your lists + IDs
              </a>.
            </p>
          ) : (
            <p className="mt-4 text-sm text-zinc-600">
              Credentials are set but the account isn’t authorized yet — click Connect and approve on Constant Contact.
            </p>
          )}
        </div>

        <div className="text-sm text-zinc-600">
          <h3 className="font-semibold text-zinc-800">When do I need to reconnect?</h3>
          <p className="mt-1">
            Almost never — the connection refreshes its own token automatically. You only need to reconnect if:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Sign-ups stop reaching Constant Contact (the access was revoked or expired after long inactivity).</li>
            <li>You removed or changed this app’s access inside Constant Contact.</li>
            <li>You switch to a different Constant Contact account.</li>
          </ul>
        </div>
      </div>
    </PortalShell>
  );
}
