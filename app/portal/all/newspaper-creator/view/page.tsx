import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getPageItems, getIssueDate } from '@/lib/queries/newspaper';
import { pageMode, coverConfig, templateId, pageHeading } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { normalizeOpEd } from '@/lib/newspaper/oped';
import { normalizePageFour } from '@/lib/newspaper/page-four';
import { normalizeClassifiedPage } from '@/lib/newspaper/classified';
import { normalizeFullAd } from '@/lib/newspaper/full-ad';
import { SectionCover } from '@/components/newspaper/section-cover';
import { PageTwo } from '@/components/newspaper/page-two';
import { PageFour } from '@/components/newspaper/page-four';
import { ClassifiedPage } from '@/components/newspaper/classified-page';
import { FullPageAd } from '@/components/newspaper/full-page-ad';
import { PageHeader } from '@/components/newspaper/page-header';
import { SectionFlag } from '@/components/newspaper/section-flag';
import { ColophonRail, COLOPHON_RAIL_W, COLOPHON_GAP } from '@/components/newspaper/colophon-rail';
import { PAGE_W_PX, PAGE_H_PX, CONTENT_W_PX, MARGIN_IN, DPI } from '@/lib/newspaper/layout-engine';
import { ProofBands, type ProofItem } from '../[pageId]/print/proof-bands';

export const metadata: Metadata = {
  title: 'View File · Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const VIEW_SCALE = 0.62;
const MARGIN_PX = Math.round(MARGIN_IN * DPI);

export default async function NewspaperViewFile() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/newspaper-creator/view');

  // Only pages checked "Include in paper", in list order.
  const [allPages, issueDate] = await Promise.all([getPages(), getIssueDate()]);
  const pages = allPages.filter((p) => p.include_in_paper !== false);

  // Resolve each page's render payload (cover data or flow items).
  const rendered = await Promise.all(
    pages.map(async (page) => {
      if (pageMode(page.kind) === 'template') {
        return { page, kind: 'template' as const };
      }
      const items = await getPageItems(page.id);
      const proofItems: ProofItem[] = items.map((it) => ({
        id: it.id,
        type: it.type,
        data: it.data ?? {},
        layout: it.layout ?? {},
      }));
      return { page, kind: 'flow' as const, proofItems };
    })
  );

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="View File"
      backLink={{ href: '/portal/all/newspaper-creator', label: 'Newspaper Creator' }}
    >
      <p className="text-sm text-zinc-600 mb-6">
        The full issue, page by page. (A future phase renders this in InDesign; for now it uses the
        same page proofs as the individual editors.)
      </p>

      <div className="flex flex-col items-center gap-8 bg-zinc-200/60 rounded p-6">
        {rendered.map(({ page, ...r }, i) => {
          const ordinal = i + 1;
          const title = pageHeading(page.title, ordinal);
          const cfg = coverConfig(page.kind);
          const fit = (page.template_data ?? {}) as { photo_scale?: number; space_scale?: number; columns?: number | null };
          const photoScale = fit.photo_scale ?? 1;
          const spaceScale = fit.space_scale ?? 1;
          const fitColumns = fit.columns ?? undefined;
          return (
            <div key={page.id} className="w-full flex flex-col items-center">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
                Page {ordinal} — {title}
              </div>
              <div
                className="bg-white shadow-md overflow-hidden"
                style={{ width: PAGE_W_PX * VIEW_SCALE, height: PAGE_H_PX * VIEW_SCALE }}
              >
                <div style={{ transform: `scale(${VIEW_SCALE})`, transformOrigin: 'top left' }}>
                  <div style={{ width: PAGE_W_PX, minHeight: PAGE_H_PX, padding: MARGIN_PX, boxSizing: 'border-box' }}>
                    {r.kind === 'template' && templateId(page.kind) === 'full_ad' ? (
                      <FullPageAd data={normalizeFullAd(page.template_data)} />
                    ) : r.kind === 'template' && templateId(page.kind) === 'oped' ? (
                      <PageTwo data={normalizeOpEd(page.template_data)} pageNumber={ordinal} dateLabel={issueDate} />
                    ) : r.kind === 'template' && templateId(page.kind) === 'page_four' ? (
                      <PageFour data={normalizePageFour(page.template_data)} pageNumber={ordinal} dateLabel={issueDate} />
                    ) : r.kind === 'template' && templateId(page.kind) === 'classified' ? (
                      <ClassifiedPage data={normalizeClassifiedPage(page.template_data)} />
                    ) : r.kind === 'template' ? (
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
                              {(r as { proofItems: ProofItem[] }).proofItems.length > 0 ? (
                                <ProofBands
                                  items={(r as { proofItems: ProofItem[] }).proofItems}
                                  contentWidthPx={CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP}
                                  photoScale={photoScale}
                                  spaceScale={spaceScale}
                                  columns={fitColumns}
                                />
                              ) : null}
                            </div>
                            <ColophonRail width={COLOPHON_RAIL_W} />
                          </div>
                        ) : (r as { proofItems: ProofItem[] }).proofItems.length > 0 ? (
                          <ProofBands items={(r as { proofItems: ProofItem[] }).proofItems} photoScale={photoScale} spaceScale={spaceScale} columns={fitColumns} />
                        ) : (
                          <p className="text-sm text-zinc-300 italic">Blank page</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Link href="/portal/all/newspaper-creator" className="text-sm font-medium text-brand-red hover:underline">
          ← Back to Newspaper Creator
        </Link>
      </div>
    </PortalShell>
  );
}
