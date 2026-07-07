import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAccount } from '@/lib/queries/accounts';
import { AccountForm } from '../account-form';

export const metadata: Metadata = {
  title: 'Edit Account',
  robots: { index: false, follow: false },
};

export default async function EditAccountPage({ params }: { params: { id: string } }) {
  const user = await requireRole(
    ['admin', 'master admin'],
    `/portal/all/accounts/${params.id}`
  );
  const account = await getAccount(params.id);
  if (!account) notFound();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Edit Account"
      backLink={{ href: '/portal/all/accounts', label: 'Account Database' }}
    >
      <AccountForm mode="edit" account={account} />
    </PortalShell>
  );
}
