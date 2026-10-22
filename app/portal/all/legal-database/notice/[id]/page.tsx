import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getLegalNotice } from '@/lib/queries/legal-notices';
import { NoticeDetailView } from './notice-detail-view';

export const metadata: Metadata = {
  title: 'Library Notice - Legal Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** A Legal Notices LIBRARY entry - the raw print copy the newspaper creator
 *  places. Editable in place; the L# + run-dates line lives inside the copy. */
export default async function NoticeDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/legal-database/notice/${params.id}`
  );
  const notice = await getLegalNotice(params.id);
  if (!notice) notFound();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title={notice.label || 'Library notice'}
      backLink={{ href: '/portal/all/legal-database', label: 'Legal Database' }}
    >
      <NoticeDetailView notice={notice} />
    </PortalShell>
  );
}
