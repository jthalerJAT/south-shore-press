import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getPages, getPage, getPageItems, adPublicUrl, type NpItem } from '@/lib/queries/newspaper';
import { PrintButton } from './print-button';

export const metadata: Metadata = {
  title: 'Page proof · Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PRINT_CSS = `
@media print {
  @page { size: letter portrait; margin: 0.5in; }
  .no-print { display: none !important; }
  body { background: white !important; }
}`;

function paragraphs(body: string | undefined): string[] {
  return String(body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default async function PagePrintProof({
  params,
}: {
  params: { pageId: string };
}) {
  await requireRole(['editor', 'admin', 'master admin'], `/portal/all/newspaper-creator/${params.pageId}/print`);

  const page = await getPage(params.pageId);
  if (!page) notFound();
  const [pages, items] = await Promise.all([getPages(), getPageItems(params.pageId)]);
  const ordinal = pages.findIndex((p) => p.id === page.id) + 1;
  const title = page.kind === 'generic' ? `Page ${ordinal}` : page.title;

  return (
    <div className="min-h-screen bg-zinc-100">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/portal/all/newspaper-creator/${page.id}`}
            className="text-sm font-medium text-brand-red hover:underline"
          >
            ← Back to editor
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="max-w-3xl mx-auto bg-white my-6 p-10 shadow-sm">
        <div className="text-center border-b-2 border-black pb-2 mb-6">
          <div className="font-headline text-2xl font-extrabold uppercase tracking-wide">
            The South Shore Press
          </div>
          <div className="text-xs text-zinc-500">
            {title} · proof
          </div>
        </div>

        {page.section_name ? (
          <div className="inline-block bg-black text-white text-xs font-bold uppercase tracking-widest px-2 py-1 mb-4">
            {page.section_name}
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No content on this page yet.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {items.map((it) =>
              it.type === 'story' ? (
                <StoryProof key={it.id} item={it} />
              ) : (
                <AdProof key={it.id} item={it} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryProof({ item }: { item: NpItem }) {
  const d = item.data;
  return (
    <article>
      {d.blue_flag ? (
        <div className="flex items-center gap-3 bg-blue-800 text-white px-3 py-2 mb-3">
          {d.author_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.author_photo_url} alt="" className="w-12 h-12 rounded object-cover bg-white/20" />
          ) : null}
          <div className="leading-tight">
            {d.blue_flag_section ? (
              <div className="text-sm font-extrabold uppercase tracking-wide">{d.blue_flag_section}</div>
            ) : null}
            {d.byline ? (
              <div className="text-xs uppercase tracking-widest text-blue-100">By {d.byline}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <h2 className="font-headline text-2xl font-bold text-zinc-900 leading-tight">
        {d.headline || <span className="text-zinc-300">[Headline]</span>}
      </h2>
      {d.subline ? <p className="mt-1 text-lg text-zinc-600">{d.subline}</p> : null}
      {!d.blue_flag && d.byline ? (
        <p className="mt-1 text-sm italic text-zinc-600">By {d.byline}</p>
      ) : null}

      {d.hero_photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.hero_photo_url} alt="" className="mt-3 w-full max-h-80 object-cover bg-zinc-100" />
      ) : null}

      <div className="mt-3 columns-1 sm:columns-2 gap-6 text-[13px] leading-relaxed text-zinc-800 [&>p]:mb-3">
        {paragraphs(d.body).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {Array.isArray(d.extra_photo_urls) && d.extra_photo_urls.filter(Boolean).length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {d.extra_photo_urls.filter(Boolean).map((u: string, i: number) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="w-full h-24 object-cover bg-zinc-100" />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AdProof({ item }: { item: NpItem }) {
  const d = item.data;
  const sizeLabel = d.ad_size === 'full' ? 'Full Page' : d.ad_size === 'half' ? 'Half Page' : 'Quarter Page';
  const heights: Record<string, string> = { full: 'h-96', half: 'h-56', quarter: 'h-32' };
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">
        Advertisement — {sizeLabel}
      </div>
      {d.storage_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={adPublicUrl(d.storage_path)}
          alt={d.file_name ?? 'Advertisement'}
          className={`w-full object-contain border border-zinc-200 ${heights[d.ad_size ?? 'quarter']}`}
        />
      ) : (
        <div className={`w-full border-2 border-dashed border-zinc-300 flex items-center justify-center text-sm text-zinc-400 ${heights[d.ad_size ?? 'quarter']}`}>
          Ad placeholder ({sizeLabel})
        </div>
      )}
    </div>
  );
}
