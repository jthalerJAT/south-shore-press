import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getPage, getPageItems } from '@/lib/queries/newspaper';
import { LayoutEditor, type InitialItem } from './layout-editor';

export const metadata: Metadata = {
  title: 'Page layout · Newspaper Creator',
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

  const [pages, items] = await Promise.all([getPages(), getPageItems(params.pageId)]);
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const displayTitle = page.kind === 'generic' ? `Page ${ordinal}` : page.title;

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
      title={`Layout — ${displayTitle}`}
      backLink={{ href: `/portal/all/newspaper-creator/${page.id}`, label: 'Page content' }}
    >
      <LayoutEditor
        pageId={page.id}
        pageTitle={displayTitle}
        sectionName={page.section_name ?? ''}
        initialItems={initialItems}
      />
    </PortalShell>
  );
}
