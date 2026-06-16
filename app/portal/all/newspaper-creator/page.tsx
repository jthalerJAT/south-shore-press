import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getItemCounts } from '@/lib/queries/newspaper';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';
import { DEFAULT_PAGES } from '@/lib/newspaper-templates';
import { NewspaperBoard } from './newspaper-board';

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

  const [counts, stories] = await Promise.all([
    getItemCounts(),
    getAllStoriesForEditor(),
  ]);

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Newspaper Creator"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <NewspaperBoard pages={pages} counts={counts} stories={stories} />
    </PortalShell>
  );
}
