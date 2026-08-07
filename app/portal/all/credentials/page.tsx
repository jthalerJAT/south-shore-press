import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { CredentialsTable } from '@/components/portal/credentials-table';
import { getAllProfiles } from '@/lib/queries/profiles';
import { getAdClients } from '@/lib/queries/ad-clients';

export const metadata: Metadata = {
  title: 'Credentials',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Credentials. Admin & master admin only.
 *
 * One unified table with every user in the system — editorial staff
 * AND self-signed-up readers. The 3 role checkboxes (Admin / Editor /
 * Journalist) apply to all rows; readers start with all 3 unchecked
 * and can be promoted by checking any of them.
 *
 * Master admins are shown locked. The viewer's own row is locked.
 * Readers (no editorial role yet) show a small READER badge for
 * visual scanning but are fully editable.
 */
export default async function CredentialsPage() {
  const user = await requireRole(
    ['admin', 'master admin'],
    '/portal/all/credentials'
  );
  const [profiles, adClients] = await Promise.all([getAllProfiles(), getAdClients()]);

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Credentials"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <CredentialsTable
        initialProfiles={profiles}
        currentUserId={user.id}
        currentUserRoles={user.roles}
        adClients={adClients.map((c) => ({ id: c.id, business_name: c.business_name }))}
      />
    </PortalShell>
  );
}
