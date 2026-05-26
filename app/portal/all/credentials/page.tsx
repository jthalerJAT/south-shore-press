import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { CredentialsTable } from '@/components/portal/credentials-table';
import { ReadersTable } from '@/components/portal/readers-table';
import { getAllProfiles, getAllReaders } from '@/lib/queries/profiles';

export const metadata: Metadata = {
  title: 'Credentials',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Credentials. Admin & master admin only.
 *
 * Top: editorial users (journalist/editor/admin/master admin) with
 * toggleable role checkboxes. Master admins are shown as locked.
 *
 * Bottom: a Readers section listing every self-signed-up reader with
 * their contact info + subscription status. Display-only — admins
 * don't toggle reader roles; readers manage their own profile from
 * /account.
 */
export default async function CredentialsPage() {
  const user = await requireRole(
    ['admin', 'master admin'],
    '/portal/all/credentials'
  );
  const [profiles, readers] = await Promise.all([
    getAllProfiles(),
    getAllReaders(),
  ]);

  // Exclude readers from the editorial credentials table — they show
  // up in the Readers section below.
  const editorialProfiles = profiles.filter((p) => {
    const editorialRoles = new Set([
      'journalist',
      'editor',
      'admin',
      'master admin',
    ]);
    return (p.roles ?? []).some((r) =>
      editorialRoles.has(String(r).toLowerCase().replace(/_/g, ' '))
    );
  });

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Credentials"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <div className="space-y-12">
        <section>
          <h2 className="font-headline text-xl font-bold text-zinc-900 mb-4">
            Editorial team
          </h2>
          <CredentialsTable
            initialProfiles={editorialProfiles}
            currentUserId={user.id}
            currentUserRoles={user.roles}
          />
        </section>

        <section>
          <ReadersTable readers={readers} />
        </section>
      </div>
    </PortalShell>
  );
}
