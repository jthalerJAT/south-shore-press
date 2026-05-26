import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { CredentialsTable } from '@/components/portal/credentials-table';
import { getAllProfiles } from '@/lib/queries/profiles';

export const metadata: Metadata = {
  title: 'Credentials',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Credentials. Admin & master admin only.
 *
 * Lists every registered profile with toggleable Admin/Editor/
 * Journalist checkboxes. Master admin users are shown as locked.
 * Self-edit is blocked server-side too.
 */
export default async function CredentialsPage() {
  const user = await requireRole(
    ['admin', 'master admin'],
    '/portal/all/credentials'
  );
  const profiles = await getAllProfiles();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Credentials"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <CredentialsTable
        initialProfiles={profiles}
        currentUserId={user.id}
        currentUserRoles={user.roles}
      />
    </PortalShell>
  );
}
