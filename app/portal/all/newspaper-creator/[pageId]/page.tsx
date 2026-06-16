import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getPage, getPageItems } from '@/lib/queries/newspaper';
import { templateFor } from '@/lib/newspaper-templates';
import { PageEditor } from './page-editor';

export const metadata: Metadata = {
  title: 'Edit Page · Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewspaperPageEditorPage({
  params,
}: {
  params: { pageId: string };
}) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/newspaper-creator/${params.pageId}`
  );

  const page = await getPage(params.pageId);
  if (!page) notFound();

  const [pages, items] = await Promise.all([
    getPages(),
    getPageItems(params.pageId),
  ]);
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const displayTitle = page.kind === 'generic' ? `Page ${ordinal}` : page.title;
  const tmpl = templateFor(page.kind);

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title={`Edit — ${displayTitle}`}
      backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
    >
      <PageEditor
        pageId={page.id}
        pageTitle={displayTitle}
        kind={page.kind}
        slots={tmpl.slots === 'open' ? null : tmpl.slots}
        initialSectionName={page.section_name ?? ''}
        initialItems={items.map((it) => ({
          type: it.type,
          slot_key: it.slot_key,
          source_story_id: it.source_story_id,
          data: it.data ?? {},
        }))}
      />
    </PortalShell>
  );
}
