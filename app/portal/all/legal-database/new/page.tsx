import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PortalShell } from '@/components/portal/portal-shell';
import { AdminLegalForm } from './admin-legal-form';

export const metadata: Metadata = {
  title: 'Create New Legal - Legal Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Staff-side legal entry - same fields the customer Legal Portal collects,
 *  for legals that arrive by phone, mail, or email. */
export default async function NewAdminLegalPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/legal-database/new'
  );

  // Reserve the L# now so the form, preview, and customer draft can show it.
  // Drawn from a Postgres sequence - abandoned forms leave a gap, never a
  // duplicate. (Collisions on save regenerate server-side too.)
  let lNumber = '';
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc('next_legal_number');
    lNumber = String(data ?? '');
  } catch (err) {
    console.error('[NewAdminLegalPage] reserve L#', err);
  }

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Create New Legal"
      backLink={{ href: '/portal/all/legal-database', label: 'Legal Database' }}
    >
      <AdminLegalForm reservedLNumber={lNumber} />
    </PortalShell>
  );
}
