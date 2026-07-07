import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getItemSummaries } from '@/lib/queries/newspaper';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';
import { getAds } from '@/lib/queries/ads';
import { getLegalsList, legalPublicUrl, formatLegalDate } from '@/lib/queries/legals';
import { getClassifiedsList, classifiedPublicUrl, formatClassifiedDate } from '@/lib/queries/classifieds';
import { DEFAULT_PAGES } from '@/lib/newspaper-templates';
import { NewspaperBoard, type LegalChip, type ClassifiedChip } from './newspaper-board';

export const metadata: Metadata = {
  title: 'Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewspaperCreatorPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/newspaper-creator'
  );

  // Seed the default pages once (first visit).
  let pages = await getPages();
  if (pages.length === 0) {
    const supabase = createClient();
    await supabase.from('np_pages').insert(
      DEFAULT_PAGES.map((p, i) => ({
        page_order: i + 1,
        kind: p.kind,
        title: p.title,
        status: 'tbd',
      }))
    );
    pages = await getPages();
  }

  const [summaries, stories, ads, legalsRaw, classifiedsRaw] = await Promise.all([
    getItemSummaries(),
    getAllStoriesForEditor(),
    getAds(),
    getLegalsList(),
    getClassifiedsList(),
  ]);

  // Pre-resolve legals + classifieds to plain data so the client board doesn't
  // import the server-only query modules.
  const legals: LegalChip[] = legalsRaw.map((l) => ({
    id: l.id,
    dateLabel: formatLegalDate(l.legal_date),
    url: legalPublicUrl(l.storage_path),
    fileName: l.file_name,
  }));
  const classifieds: ClassifiedChip[] = classifiedsRaw.map((c) => ({
    id: c.id,
    dateLabel: formatClassifiedDate(c.classified_date),
    url: classifiedPublicUrl(c.storage_path),
    fileName: c.file_name,
  }));

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Newspaper Creator"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <NewspaperBoard
        pages={pages}
        summaries={summaries}
        stories={stories}
        ads={ads}
        legals={legals}
        classifieds={classifieds}
      />
    </PortalShell>
  );
}
