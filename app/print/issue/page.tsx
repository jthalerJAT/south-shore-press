import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { pageMode, coverConfig, templateId } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { normalizeOpEd } from '@/lib/newspaper/oped';
import { SectionCover } from '@/components/newspaper/section-cover';
import { PageTwo } from '@/components/newspaper/page-two';
import { CONTENT_W_PX } from '@/lib/newspaper/layout-engine';
import type { NpPage } from '@/lib/queries/newspaper';
import { ProofBands, type ProofItem } from '../../portal/all/newspaper-creator/[pageId]/print/proof-bands';

export const dynamic = 'force-dynamic';

/**
 * Bare, chrome-free print view of the issue at the exact 11×15 trim size, for
 * the headless-Chromium → PDF → PDF/X-1a export pipeline (scripts/export-issue-
 * pdf.mjs). Token-guarded via ?token so the renderer can reach it without a
 * login. ?pages=1,2 limits to specific page numbers.
 */
export default async function PrintIssue({
  searchParams,
}: {
  searchParams: { token?: string; pages?: string };
}) {
  const expected = process.env.INDESIGN_API_TOKEN;
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
        return (
          <div className="ssp-pg" key={r.page.id}>
            {r.kind === 'template' && templateId(r.page.kind) === 'oped' ? (
              <PageTwo data={normalizeOpEd(r.page.template_data)} pageNumber={r.ordinal} dateLabel={issueDate} />
            ) : r.kind === 'template' ? (
              <SectionCover
                data={normalizeCover(r.page.template_data, r.page.kind)}
                variant={cfg?.variant ?? 'news'}
                mastheadWord={cfg?.mastheadWord}
              />
            ) : r.proofItems.length > 0 ? (
              <div style={{ width: CONTENT_W_PX }}>
                <ProofBands items={r.proofItems} />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
