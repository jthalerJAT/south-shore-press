import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getPage, getPageItems, getIssueDate } from '@/lib/queries/newspaper';
import { templateFor, pageMode, coverConfig, templateId, pageHeading } from '@/lib/newspaper-templates';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';
import { getAds } from '@/lib/queries/ads';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { normalizeOpEd } from '@/lib/newspaper/oped';
import { normalizePageFour } from '@/lib/newspaper/page-four';
import { normalizeFullAd } from '@/lib/newspaper/full-ad';
import { normalizeClassifiedPage } from '@/lib/newspaper/classified';
import { getClassifiedsList, formatClassifiedDate } from '@/lib/queries/classifieds';
import { PageEditor } from './page-editor';
import { CoverEditor } from './cover-editor';
import { OpEdEditor } from './oped-editor';
import { PageFourEditor } from './page-four-editor';
import { ClassifiedEditor } from './classified-editor';
import { FullAdEditor } from './full-ad-editor';

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

  const pages = await getPages();
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const displayTitle = pageHeading(page.title, ordinal);

  // Template pages use a bespoke field editor; flow pages use the story-form
  // Page Editor + the Phase 2A layout engine.
  if (pageMode(page.kind) === 'template') {
    const tid = templateId(page.kind);

    if (tid === 'full_ad') {
      return (
        <PortalShell
          user={user}
          activeTab="all"
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <FullAdEditor pageId={page.id} initialData={normalizeFullAd(page.template_data)} />
        </PortalShell>
      );
    }

    if (tid === 'oped') {
      const [stories, ads, issueDate] = await Promise.all([
        getAllStoriesForEditor(),
        getAds(),
        getIssueDate(),
      ]);
      return (
        <PortalShell
          user={user}
          activeTab="all"
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <OpEdEditor
            pageId={page.id}
            pageNumber={ordinal}
            dateLabel={issueDate}
            initialData={normalizeOpEd(page.template_data)}
            stories={stories}
            ads={ads}
          />
        </PortalShell>
      );
    }

    if (tid === 'page_four') {
      const [stories, ads, issueDate] = await Promise.all([
        getAllStoriesForEditor(),
        getAds(),
        getIssueDate(),
      ]);
      return (
        <PortalShell
          user={user}
          activeTab="all"
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <PageFourEditor
            pageId={page.id}
            pageNumber={ordinal}
            dateLabel={issueDate}
            initialData={normalizePageFour(page.template_data)}
            stories={stories}
            ads={ads}
          />
        </PortalShell>
      );
    }

    if (tid === 'classified') {
      const classifieds = await getClassifiedsList();
      const options = classifieds.map((c) => ({
        id: c.id,
        dateLabel: formatClassifiedDate(c.classified_date),
        fileName: c.file_name,
        storagePath: c.storage_path,
      }));
      return (
        <PortalShell
          user={user}
          activeTab="all"
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <ClassifiedEditor
            pageId={page.id}
            initialData={normalizeClassifiedPage(page.template_data)}
            options={options}
          />
        </PortalShell>
      );
    }

    const cfg = coverConfig(page.kind);
    const stories = await getAllStoriesForEditor();
    return (
      <PortalShell
        user={user}
        activeTab="all"
        title={`Edit — ${displayTitle}`}
        backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
      >
        <CoverEditor
          pageId={page.id}
          variant={cfg?.variant ?? 'news'}
          mastheadWord={cfg?.mastheadWord}
          initialData={normalizeCover(page.template_data, page.kind)}
          stories={stories}
        />
      </PortalShell>
    );
  }

  const [items, editorStories] = await Promise.all([
    getPageItems(params.pageId),
    getAllStoriesForEditor(),
  ]);
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
        initialShowColophon={Boolean((page.template_data as { show_colophon?: boolean })?.show_colophon)}
        editorStories={editorStories}
      />
    </PortalShell>
  );
}
