import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAccounts } from '@/lib/queries/accounts';
import { AccountsClient } from './accounts-client';

export const metadata: Metadata = {
  title: 'Account Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Account Database — the internal master list of every subscriber, mailer,
 * advertiser and login. Admin-only. Search / sort / filter every field,
 * multi-select to permanently delete (e.g. stale weekly mailers), and add or
 * edit accounts by hand.
 */
export default async function AccountsPage() {
  const user = await requireRole(['admin', 'master admin'], '/portal/all/accounts');
  const accounts = await getAccounts();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Account Database"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <AccountsClient accounts={accounts} />
    </PortalShell>
  );
}
