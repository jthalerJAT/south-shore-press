import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getPages, getPage, getPageItems, getIssueDate } from '@/lib/queries/newspaper';
import { pageMode, coverConfig, templateId, pageHeading } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { normalizeOpEd } from '@/lib/newspaper/oped';
import { normalizePageFour } from '@/lib/newspaper/page-four';
import { normalizeFullAd } from '@/lib/newspaper/full-ad';
import { normalizeClassifiedPage } from '@/lib/newspaper/classified';
import { normalizeFunPage } from '@/lib/newspaper/fun-page';
import { normalizeLegalPage } from '@/lib/newspaper/legal-page';
import { LegalPage } from '@/components/newspaper/legal-page';
import { SectionCover } from '@/components/newspaper/section-cover';
import { PageTwo } from '@/components/newspaper/page-two';
import { PageFour } from '@/components/newspaper/page-four';
import { ClassifiedPage } from '@/components/newspaper/classified-page';
import { FullPageAd } from '@/components/newspaper/full-page-ad';
import { FunPage } from '@/components/newspaper/fun-page';
import { PageHeader } from '@/components/newspaper/page-header';
import { SectionFlag } from '@/components/newspaper/section-flag';
import { ColophonRail, COLOPHON_RAIL_W, COLOPHON_GAP } from '@/components/newspaper/colophon-rail';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { PrintButton } from './print-button';
import { ProofBands, type ProofItem } from './proof-bands';

export const metadata: Metadata = {
  title: 'Page proof · Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

// The paper is an 11×15 tabloid; print to that sheet with the same 0.5in
// margins the layout engine assumes, so the proof matches the editor canvas.
const PRINT_CSS = `
@media print {
  @page { size: 11in 15in; margin: 0.5in; }
  .no-print { display: none !important; }
  body { background: white !important; }
}`;

export default async function PagePrintProof({
  params,
}: {
  params: { pageId: string };
}) {
  await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/newspaper-creator/${params.pageId}/print`
  );

  const page = await getPage(params.pageId);
  if (!page) notFound();
  const [pages, items, issueDate] = await Promise.all([
    getPages(),
    getPageItems(params.pageId),
    getIssueDate(),
  ]);
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const title = pageHeading(page.title, ordinal);

  const isTemplate = pageMode(page.kind) === 'template';
  const tid = templateId(page.kind);
  const cfg = isTemplate ? coverConfig(page.kind) : null;

  // Flow-page "fit" levers (set in the page editor, stored in template_data).
  const fit = (page.template_data ?? {}) as { photo_scale?: number; space_scale?: number; columns?: number | null };
  const photoScale = fit.photo_scale ?? 1;
  const spaceScale = fit.space_scale ?? 1;
  const fitColumns = fit.columns ?? undefined;

  const proofItems: ProofItem[] = items.map((it) => ({
    id: it.id,
    type: it.type,
    data: it.data ?? {},
    layout: it.layout ?? {},
  }));

  return (
    <div className="min-h-screen bg-zinc-100">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/portal/all/newspaper-creator/${page.id}`}
            className="text-sm font-medium text-brand-red hover:underline"
          >
            ← Back to editor
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto bg-white my-6 p-12 shadow-sm w-fit overflow-x-auto">
        {/* Clip to the TRUE printable area (the 10×14in text box of an 11×15
            page). Anything past the bottom edge is cut off — exactly as it will
            be on the printed sheet — so this proof can't mislead by stretching. */}
        <div style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, overflow: 'hidden', position: 'relative', outline: '1px solid #e4e4e7' }}>
        {isTemplate && tid === 'full_ad' ? (
          <FullPageAd data={normalizeFullAd(page.template_data)} />
        ) : isTemplate && tid === 'oped' ? (
          <PageTwo data={normalizeOpEd(page.template_data)} pageNumber={ordinal} dateLabel={issueDate} />
        ) : isTemplate && tid === 'page_four' ? (
          <PageFour data={normalizePageFour(page.template_data)} pageNumber={ordinal} dateLabel={issueDate} />
        ) : isTemplate && tid === 'classified' ? (
          <ClassifiedPage data={normalizeClassifiedPage(page.template_data)} />
        ) : isTemplate && tid === 'fun' ? (
          <FunPage data={normalizeFunPage(page.template_data)} />
        ) : isTemplate && tid === 'legal' ? (
          <LegalPage data={normalizeLegalPage(page.template_data)} pageNumber={ordinal} dateLabel={issueDate} />
        ) : isTemplate ? (
          <SectionCover
            data={normalizeCover(page.template_data, page.kind)}
            variant={cfg?.variant ?? 'news'}
            mastheadWord={cfg?.mastheadWord}
          />
        ) : (
          <div style={{ width: CONTENT_W_PX }}>
            <PageHeader pageNumber={ordinal} dateLabel={issueDate} />
            <SectionFlag label={page.section_name} />
            {(page.template_data as { show_colophon?: boolean })?.show_colophon ? (
              <div style={{ display: 'flex', gap: COLOPHON_GAP, width: CONTENT_W_PX }}>
                <div style={{ width: CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP }}>
                  {proofItems.length > 0 ? (
                    <ProofBands items={proofItems} contentWidthPx={CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP} photoScale={photoScale} spaceScale={spaceScale} columns={fitColumns} />
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No content on this page yet.</p>
                  )}
                </div>
                <ColophonRail width={COLOPHON_RAIL_W} />
              </div>
            ) : proofItems.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">No content on this page yet.</p>
            ) : (
              <ProofBands items={proofItems} photoScale={photoScale} spaceScale={spaceScale} columns={fitColumns} />
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
