import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { AccountForm } from '../account-form';

export const metadata: Metadata = {
  title: 'New Account',
  robots: { index: false, follow: false },
};

export default async function NewAccountPage() {
  const user = await requireRole(['admin', 'master admin'], '/portal/all/accounts/new');
  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="New Account"
      backLink={{ href: '/portal/all/accounts', label: 'Account Database' }}
    >
      <AccountForm mode="create" />
    </PortalShell>
  );
}
