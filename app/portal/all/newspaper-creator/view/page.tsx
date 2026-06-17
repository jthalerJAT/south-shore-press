import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPages, getPageItems } from '@/lib/queries/newspaper';
import { pageMode, coverConfig } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { SectionCover } from '@/components/newspaper/section-cover';
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
  const pages = (await getPages()).filter((p) => p.include_in_paper !== false);

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
          const title = page.kind === 'generic' ? `Page ${ordinal}` : page.title;
          const cfg = coverConfig(page.kind);
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
                    {r.kind === 'template' ? (
                      <SectionCover
                        data={normalizeCover(page.template_data, page.kind)}
                        variant={cfg?.variant ?? 'news'}
                        mastheadWord={cfg?.mastheadWord}
                      />
                    ) : (r as { proofItems: ProofItem[] }).proofItems.length > 0 ? (
                      <div style={{ width: CONTENT_W_PX }}>
                        <ProofBands items={(r as { proofItems: ProofItem[] }).proofItems} />
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-300 italic">Blank page</p>
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
