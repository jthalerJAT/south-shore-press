import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { pageMode, coverConfig, templateId } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { normalizeOpEd } from '@/lib/newspaper/oped';
import { normalizePageFour } from '@/lib/newspaper/page-four';
import { normalizeClassifiedPage } from '@/lib/newspaper/classified';
import { normalizeFullAd } from '@/lib/newspaper/full-ad';
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
import { ColophonRail } from '@/components/newspaper/colophon-rail';
import { COLOPHON_RAIL_W, COLOPHON_GAP } from '@/lib/newspaper/colophon';
import { CONTENT_W_PX } from '@/lib/newspaper/layout-engine';
import type { NpPage } from '@/lib/queries/newspaper';
import { ProofBands, type ProofItem } from '../../portal/all/newspaper-creator/[pageId]/print/proof-bands';

export const dynamic = 'force-dynamic';

/**
 * Bare, chrome-free print view of the issue at the exact 11×15 trim size, for
 * the headless-Chromium → PDF → PDF/X-1a export pipeline (scripts/export-issue-
 * pdf.mjs). Token-guarded via ?token (PRINT_API_TOKEN) so the renderer can reach
 * it without a login. ?pages=1,2 limits to specific page numbers.
 */
export default async function PrintIssue({
  searchParams,
}: {
  searchParams: { token?: string; pages?: string };
}) {
  const expected = process.env.PRINT_API_TOKEN ?? process.env.INDESIGN_API_TOKEN;
  if (!expected || searchParams.token !== expected) notFound();

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('np_pages')
    .select('*')
    .order('page_order', { ascending: true });

  const all = ((rows ?? []) as NpPage[]).filter((p) => p.include_in_paper !== false);
  const front = all.find((p) => p.kind === 'front');
  const issueDate = ((front?.template_data ?? {}) as { issue_date?: string }).issue_date ?? '';

  const withOrdinal = all.map((page, i) => ({ page, ordinal: i + 1 }));
  const want = searchParams.pages
    ? new Set(searchParams.pages.split(',').map((s) => parseInt(s.trim(), 10)))
    : null;
  const selected = want ? withOrdinal.filter((x) => want.has(x.ordinal)) : withOrdinal;

  const rendered = await Promise.all(
    selected.map(async ({ page, ordinal }) => {
      if (pageMode(page.kind) === 'template') return { page, ordinal, kind: 'template' as const };
      const { data: items } = await admin
        .from('np_items')
        .select('*')
        .eq('page_id', page.id)
        .order('item_order', { ascending: true });
      const proofItems: ProofItem[] = (items ?? []).map((it) => {
        const r = it as { id: string; type: 'story' | 'ad'; data?: unknown; layout?: unknown };
        return { id: r.id, type: r.type, data: (r.data ?? {}) as ProofItem['data'], layout: (r.layout ?? {}) as Record<string, unknown> };
      });
      return { page, ordinal, kind: 'flow' as const, proofItems };
    })
  );

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page { size: 11in 15in; margin: 0; }
        /* Hide the site chrome on screen + print so this route is just the pages. */
        header, footer, .no-print { display: none !important; }
        body { background: #fff !important; }
        .ssp-pg { width: 11in; height: 15in; box-sizing: border-box; padding: 0.5in; overflow: hidden; background: #fff; break-after: page; }
        .ssp-pg:last-child { break-after: auto; }
      `,
        }}
      />
      {rendered.map((r) => {
        const cfg = coverConfig(r.page.kind);
        const fit = (r.page.template_data ?? {}) as { photo_scale?: number; space_scale?: number; columns?: number | null };
        const photoScale = fit.photo_scale ?? 1;
        const spaceScale = fit.space_scale ?? 1;
        const fitColumns = fit.columns ?? undefined;
        return (
          <div className="ssp-pg" key={r.page.id}>
            {r.kind === 'template' && templateId(r.page.kind) === 'full_ad' ? (
              <FullPageAd data={normalizeFullAd(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' && templateId(r.page.kind) === 'oped' ? (
              <PageTwo data={normalizeOpEd(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' && templateId(r.page.kind) === 'page_four' ? (
              <PageFour data={normalizePageFour(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' && templateId(r.page.kind) === 'classified' ? (
              <ClassifiedPage data={normalizeClassifiedPage(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' && templateId(r.page.kind) === 'fun' ? (
              <FunPage data={normalizeFunPage(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' && templateId(r.page.kind) === 'legal' ? (
              <LegalPage data={normalizeLegalPage(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' ? (
              <SectionCover
                data={normalizeCover(r.page.template_data, r.page.kind)}
                variant={cfg?.variant ?? 'news'}
                mastheadWord={cfg?.mastheadWord}
                issueDate={issueDate}
              />
            ) : (
              <div style={{ width: CONTENT_W_PX }}>
                <PageHeader pageNumber={r.ordinal} dateLabel={issueDate} />
                <SectionFlag label={r.page.section_name} />
                {(r.page.template_data as { show_colophon?: boolean })?.show_colophon ? (
                  <div style={{ display: 'flex', gap: COLOPHON_GAP, width: CONTENT_W_PX }}>
                    <div style={{ width: CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP }}>
                      {r.proofItems.length > 0 ? (
                        <ProofBands items={r.proofItems} contentWidthPx={CONTENT_W_PX - COLOPHON_RAIL_W - COLOPHON_GAP} photoScale={photoScale} spaceScale={spaceScale} columns={fitColumns} />
                      ) : null}
                    </div>
                    <ColophonRail width={COLOPHON_RAIL_W} />
                  </div>
                ) : r.proofItems.length > 0 ? (
                  <ProofBands items={r.proofItems} photoScale={photoScale} spaceScale={spaceScale} columns={fitColumns} />
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
