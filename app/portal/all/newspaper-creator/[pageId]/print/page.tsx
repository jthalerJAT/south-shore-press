import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getPages, getPage, getPageItems, getIssueDate } from '@/lib/queries/newspaper';
import { pageMode, coverConfig, templateId } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { normalizeOpEd } from '@/lib/newspaper/oped';
import { normalizeFullAd } from '@/lib/newspaper/full-ad';
import { SectionCover } from '@/components/newspaper/section-cover';
import { PageTwo } from '@/components/newspaper/page-two';
import { FullPageAd } from '@/components/newspaper/full-page-ad';
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
  const title = page.kind === 'generic' ? `Page ${ordinal}` : page.title;

  const isTemplate = pageMode(page.kind) === 'template';
  const tid = templateId(page.kind);
  const cfg = isTemplate ? coverConfig(page.kind) : null;

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
        {isTemplate && tid === 'full_ad' ? (
          <FullPageAd data={normalizeFullAd(page.template_data)} />
        ) : isTemplate && tid === 'oped' ? (
          <PageTwo data={normalizeOpEd(page.template_data)} pageNumber={ordinal} dateLabel={issueDate} />
        ) : isTemplate ? (
          <SectionCover
            data={normalizeCover(page.template_data, page.kind)}
            variant={cfg?.variant ?? 'news'}
            mastheadWord={cfg?.mastheadWord}
          />
        ) : (
          <>
            <div className="text-center border-b-2 border-black pb-2 mb-6">
              <div className="font-headline text-2xl font-extrabold uppercase tracking-wide">
                The South Shore Press
              </div>
              <div className="text-xs text-zinc-500">{title} · proof</div>
            </div>

            {page.section_name ? (
              <div className="inline-block bg-black text-white text-xs font-bold uppercase tracking-widest px-2 py-1 mb-4">
                {page.section_name}
              </div>
            ) : null}

            {proofItems.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">No content on this page yet.</p>
            ) : (
              <ProofBands items={proofItems} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
