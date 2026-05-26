import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';

export const metadata: Metadata = {
  title: 'Credentials',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Credentials. Placeholder for the role-management
 * UI: list all profiles + their current role, dropdown to change.
 *
 * Eventual implementation:
 *   - Server-side: getAllProfiles() + updateProfileRole(userId, role)
 *     server action gated to master admin
 *   - Client UI: searchable table with role dropdown per row, "Save"
 *     button or auto-save on change
 */
export default async function CredentialsPage() {
  const user = await requireRole(
    ['admin', 'master admin'],
    '/portal/all/credentials'
  );

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Credentials"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <div className="max-w-2xl mx-auto py-10 text-center">
        <div className="inline-block bg-zinc-50 border border-zinc-200 rounded px-6 py-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
            Coming soon
          </div>
          <h2 className="mt-2 font-headline text-xl font-bold text-zinc-900">
            User role management
          </h2>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            This page will list every account in the system with their
            current role (journalist / editor / admin / master admin) and
            let master admins promote or demote users. Wiring it up is
            next.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
