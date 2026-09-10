import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getDigitalPapers, digitalPaperPublicUrl } from '@/lib/queries/digital-papers';
import { DigitalPaperAdmin } from './digital-paper-admin';

export const metadata: Metadata = {
  title: 'Digital Paper',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function formatIssueDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function DigitalPaperPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/digital-paper'
  );

  const { rows, error } = await getDigitalPapers();
  const isAdmin = user.role === 'admin' || user.role === 'master admin';
  const papers = rows.map((p) => ({
    id: p.id,
    iso: p.issue_date,
    dateLabel: formatIssueDate(p.issue_date),
    url: digitalPaperPublicUrl(p.storage_path),
    fileName: p.file_name,
    pageCount: p.page_count,
    sizeMb: p.file_size_bytes ? p.file_size_bytes / 1e6 : null,
  }));

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Digital Paper"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      {error === 'migration' ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The <code>digital_papers</code> table isn&rsquo;t in the database yet — run{' '}
          <code>db/migrations/047_digital_papers.sql</code> in the Supabase SQL editor, then reload.
        </div>
      ) : error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <DigitalPaperAdmin papers={papers} isAdmin={isAdmin} />
    </PortalShell>
  );
}
