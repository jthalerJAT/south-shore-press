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
import { normalizeFunPage, getFunSource } from '@/lib/newspaper/fun-page';
import { normalizeLegalPage } from '@/lib/newspaper/legal-page';
import { normalizeElectionSection } from '@/lib/newspaper/election-page';
import { getLegalNotices } from '@/lib/queries/legal-notices';
import { getClassifiedsList, formatClassifiedDate } from '@/lib/queries/classifieds';
import { PageEditor } from './page-editor';
import { CoverEditor } from './cover-editor';
import { OpEdEditor } from './oped-editor';
import { PageFourEditor } from './page-four-editor';
import { ClassifiedEditor } from './classified-editor';
import { FullAdEditor } from './full-ad-editor';
import { FunEditor } from './fun-editor';
import { LegalEditor } from './legal-editor';
import { ElectionEditor } from './election-editor';

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

  // Scope the page list to THIS page's issue variant so ordinals (and the
  // election section) stay correct even when editing the non-active issue.
  const pages = await getPages(page.variant ?? 'standard');
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const displayTitle = pageHeading(page.title, ordinal);

  // Template pages use a bespoke field editor; flow pages use the story-form
  // Page Editor + the Phase 2A layout engine.
  if (pageMode(page.kind) === 'template') {
    const tid = templateId(page.kind);

    if (tid === 'full_ad') {
      const [issueDate, ads] = await Promise.all([getIssueDate(), getAds()]);
      return (
        <PortalShell
          user={user}
          activeTab="all"
          hideTabs
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <FullAdEditor
            pageId={page.id}
            pageNumber={ordinal}
            dateLabel={issueDate}
            initialData={normalizeFullAd(page.template_data)}
            ads={ads}
          />
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
          hideTabs
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
          hideTabs
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

    if (tid === 'fun') {
      const source = getFunSource(page.kind);
      if (!source) notFound();
      const [ads, stories, funIssueDate] = await Promise.all([
        getAds(),
        getAllStoriesForEditor(),
        getIssueDate(),
      ]);
      return (
        <PortalShell
          user={user}
          activeTab="all"
          hideTabs
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <FunEditor
            pageId={page.id}
            source={source}
            pageNumber={ordinal}
            dateLabel={funIssueDate}
            initialData={normalizeFunPage(page.template_data)}
            ads={ads}
            stories={stories}
          />
        </PortalShell>
      );
    }

    if (tid === 'legal') {
      const [savedNotices, issueDate] = await Promise.all([getLegalNotices(), getIssueDate()]);
      return (
        <PortalShell
          user={user}
          activeTab="all"
          hideTabs
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <LegalEditor
            pageId={page.id}
            pageNumber={ordinal}
            dateLabel={issueDate}
            initialData={normalizeLegalPage(page.template_data)}
            savedNotices={savedNotices}
          />
        </PortalShell>
      );
    }

    if (tid === 'election') {
      // The SECTION spans every election page: one editor for all of them.
      // Content lives on the FIRST election page's template_data.
      const electionPages = pages.filter((p) => p.kind === 'election');
      const first = electionPages[0] ?? page;
      const ordinals = electionPages.map((p) => pages.findIndex((x) => x.id === p.id) + 1);
      const issueDate = await getIssueDate();
      return (
        <PortalShell
          user={user}
          activeTab="all"
          hideTabs
          title="Edit — Election Coverage"
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <ElectionEditor
            firstPageId={first.id}
            otherPageIds={electionPages.slice(1).map((p) => p.id)}
            pageOrdinals={ordinals.length > 0 ? ordinals : [ordinal]}
            dateLabel={issueDate}
            initialData={normalizeElectionSection(first.template_data)}
          />
        </PortalShell>
      );
    }

    if (tid === 'classified') {
      const [classifieds, issueDate] = await Promise.all([getClassifiedsList(), getIssueDate()]);
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
          hideTabs
          title={`Edit — ${displayTitle}`}
          backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
        >
          <ClassifiedEditor
            pageId={page.id}
            pageNumber={ordinal}
            dateLabel={issueDate}
            initialData={normalizeClassifiedPage(page.template_data)}
            options={options}
          />
        </PortalShell>
      );
    }

    const cfg = coverConfig(page.kind);
    const [stories, coverIssueDate] = await Promise.all([getAllStoriesForEditor(), getIssueDate()]);
    return (
      <PortalShell
        user={user}
        activeTab="all"
        hideTabs
        title={`Edit — ${displayTitle}`}
        backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
      >
        <CoverEditor
          pageId={page.id}
          variant={cfg?.variant ?? 'news'}
          mastheadWord={cfg?.mastheadWord}
          issueDate={coverIssueDate}
          initialData={normalizeCover(page.template_data, page.kind)}
          stories={stories}
        />
      </PortalShell>
    );
  }

  const [items, editorStories, ads, issueDate] = await Promise.all([
    getPageItems(params.pageId),
    getAllStoriesForEditor(),
    getAds(),
    getIssueDate(),
  ]);
  const tmpl = templateFor(page.kind);

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
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
          layout: (it.layout ?? {}) as Record<string, unknown>,
        }))}
        initialShowColophon={Boolean((page.template_data as { show_colophon?: boolean })?.show_colophon)}
        initialPhotoScale={(page.template_data as { photo_scale?: number })?.photo_scale ?? 1}
        initialSpaceScale={(page.template_data as { space_scale?: number })?.space_scale ?? 1}
        initialColumns={(page.template_data as { columns?: number | null })?.columns ?? null}
        editorStories={editorStories}
        ads={ads}
        pageNumber={ordinal}
        dateLabel={issueDate}
      />
    </PortalShell>
  );
}
