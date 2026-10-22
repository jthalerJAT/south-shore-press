import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getPage, getPageItems, getIssueDate } from '@/lib/queries/newspaper';
import { pageHeading } from '@/lib/newspaper-templates';
import { LayoutEditor, type InitialItem } from './layout-editor';
import { pageScope } from '@/lib/newspaper/edit-lock';
import { PagePager } from '@/components/portal/page-pager';
import { EditLockBoundary } from '@/components/portal/edit-lock';

export const metadata: Metadata = {
  title: 'Page layout - Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewspaperLayoutPage({
  params,
}: {
  params: { pageId: string };
}) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/newspaper-creator/${params.pageId}/layout`
  );

  const page = await getPage(params.pageId);
  if (!page) notFound();

  const [pages, items, issueDate] = await Promise.all([
    // This page's own issue variant, so ordinals match the board even when
    // editing the issue that isn't currently selected.
    getPages(page.variant ?? 'standard'),
    getPageItems(params.pageId),
    getIssueDate(),
  ]);
  const td = (page.template_data ?? {}) as {
    show_colophon?: boolean;
    space_scale?: number;
    photo_scale?: number;
    columns?: number | null;
  };
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const displayTitle = pageHeading(page.title, ordinal);

  const initialItems: InitialItem[] = items.map((it) => ({
    id: it.id,
    type: it.type,
    slot_key: it.slot_key,
    source_story_id: it.source_story_id,
    data: it.data ?? {},
    layout: it.layout ?? {},
  }));

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title={`Layout - ${displayTitle}`}
      backLink={{ href: `/portal/all/newspaper-creator/${page.id}`, label: 'Page content' }}
      headerRight={
        // Flipping through the deck stays in the layout editor.
        <PagePager
          prev={
            ordinal > 1
              ? {
                  id: pages[ordinal - 2].id,
                  ordinal: ordinal - 1,
                  title: pageHeading(pages[ordinal - 2].title, ordinal - 1),
                }
              : null
          }
          next={
            ordinal > 0 && ordinal < pages.length
              ? {
                  id: pages[ordinal].id,
                  ordinal: ordinal + 1,
                  title: pageHeading(pages[ordinal].title, ordinal + 1),
                }
              : null
          }
          suffix="/layout"
        />
      }
    >
      <EditLockBoundary scope={pageScope(page.id)}>
      <LayoutEditor
        pageId={page.id}
        pageTitle={displayTitle}
        sectionName={page.section_name ?? ''}
        initialItems={initialItems}
        pageFit={{ columns: td.columns ?? null, photoScale: td.photo_scale ?? 1 }}
        pageNumber={ordinal}
        dateLabel={issueDate}
        showColophon={Boolean(td.show_colophon)}
        spaceScale={td.space_scale ?? 1}
      />
      </EditLockBoundary>
    </PortalShell>
  );
}
