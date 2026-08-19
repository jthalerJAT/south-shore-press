import type { Metadata } from 'next';
import Link from 'next/link';
import { requireMasterAdmin } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAdminStories } from '@/lib/queries/admin-stories';
import { AdminStoriesList } from './admin-stories-list';

export const metadata: Metadata = {
  title: 'Master Admin Stories',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MasterAdminStoriesPage() {
  const user = await requireMasterAdmin('/portal/all/master-admin-stories');
  const { rows, error } = await getAdminStories();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Master Admin Stories"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <p className="text-sm text-zinc-600 max-w-2xl">
          Your private story bank. AI drafts from Howard Roark, Gail Wynand and Henry Cameron land
          here first; stories you write and save as Admin Drafts stay here too. Open a story to edit
          it, ask the AI to revise it, then Save to Admin Draft or Push to the Story Editor.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/all/master-admin-stories/guidelines"
            className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            Writing Guidelines
          </Link>
          <Link
            href="/portal/all/master-admin-stories/new"
            className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            + New Story
          </Link>
        </div>
      </div>

      {error === 'migration' ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The <code>admin_stories</code> table isn&rsquo;t in the database yet — run{' '}
          <code>db/migrations/044_master_admin_stories.sql</code> in the Supabase SQL editor, then
          reload this page. Until then the AI desks fall back to posting ordinary Story Editor drafts.
        </div>
      ) : error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <AdminStoriesList rows={rows} />
    </PortalShell>
  );
}
