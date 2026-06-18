'use client';

/**
 * PageTwo — to-scale renderer for the Page 2 ("OpEd") template: a Newsroom
 * Main OpEd (blue flag + author photo + columned text + photo), a Second Story,
 * and a Bottom Ad. Shared by the editor preview, View File, and the print
 * proof. Renders at the page content size in unscaled print px.
 */
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { adFilePublicUrl } from '@/lib/ad-files';
import { PageHeader } from './page-header';
import type { OpEdData } from '@/lib/newspaper/oped';

const NAVY = '#0b2a4a';
const BLUE = '#1e3a8a';

function paragraphs(body: string | undefined): string[] {
  return String(body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function BlueFlag({ columnName, author, photoUrl }: { columnName?: string; author?: string; photoUrl?: string }) {
  return (
    <div className="inline-flex items-stretch mb-3" style={{ background: BLUE, color: '#fff' }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.15)' }} />
      )}
      <div className="px-3 py-1 flex flex-col justify-center leading-tight">
        <span style={{ fontSize: 13, fontStyle: 'italic' }}>From the</span>
        <span className="font-headline" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
          {columnName || 'NEWSROOM'}
        </span>
        <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>
          BY {(author || '—').toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function Figure({ url, caption, width }: { url?: string; caption?: string; width: number }) {
  if (!url) return null;
  return (
    <figure style={{ float: 'right', width, marginLeft: 12, marginBottom: 6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" style={{ width: '100%', objectFit: 'cover', background: '#e4e4e7' }} />
      {caption ? (
        <figcaption style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export function PageTwo({
  data,
  pageNumber,
  dateLabel,
}: {
  data: OpEdData;
  pageNumber: number;
  dateLabel?: string;
}) {
  const adUrl = data.bottom_ad?.storage_path ? adFilePublicUrl(data.bottom_ad.storage_path) : null;

  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, minHeight: CONTENT_H_PX, background: '#fff', color: '#111' }}
    >
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />

      {/* ── Main OpEd ─────────────────────────────────────── */}
      <section>
        <BlueFlag columnName={data.main.column_name} author={data.main.author} photoUrl={data.main.author_photo_url} />
        <h2
          className="font-headline text-center"
          style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.02, color: BLUE, margin: '4px 0 10px' }}
        >
          {data.main.title || <span style={{ color: '#d4d4d8' }}>[OpEd Title]</span>}
        </h2>
        <div style={{ columnCount: 4, columnGap: 16, fontSize: 12.5, lineHeight: '17px', textAlign: 'justify' }}>
          <Figure url={data.main.photo_url} caption={data.main.photo_caption} width={260} />
          {paragraphs(data.main.text).map((p, i) => (
            <p key={i} style={{ margin: '0 0 8px' }}>
              {p}
            </p>
          ))}
        </div>
      </section>

      <div style={{ borderTop: '1px solid #000', margin: '16px 0' }} />

      {/* ── Second Story ──────────────────────────────────── */}
      <section>
        <h3 className="font-headline" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.03, color: BLUE }}>
          {data.second.headline || <span style={{ color: '#d4d4d8' }}>[Second Story Headline]</span>}
        </h3>
        {data.second.author ? (
          <p style={{ fontSize: 12, fontStyle: 'italic', color: '#3f3f46', margin: '2px 0 6px' }}>
            By {data.second.author}
          </p>
        ) : null}
        <div style={{ columnCount: 3, columnGap: 16, fontSize: 12.5, lineHeight: '17px', textAlign: 'justify' }}>
          <Figure url={data.second.photo_url} caption={data.second.photo_caption} width={220} />
          {paragraphs(data.second.text).map((p, i) => (
            <p key={i} style={{ margin: '0 0 8px' }}>
              {p}
            </p>
          ))}
        </div>
        {data.second.extra_photo_url ? (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.second.extra_photo_url} alt="" style={{ width: 240, objectFit: 'cover', background: '#e4e4e7' }} />
          </div>
        ) : null}
      </section>

      {/* ── Bottom Ad ─────────────────────────────────────── */}
      <section className="mt-auto pt-4">
        <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Advertisement</div>
        {adUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={adUrl} alt={data.bottom_ad?.file_name ?? 'Advertisement'} style={{ width: '100%', maxHeight: 280, objectFit: 'contain', border: '1px solid #e4e4e7' }} />
        ) : (
          <div className="w-full border-2 border-dashed border-zinc-300 flex items-center justify-center text-sm text-zinc-400" style={{ height: 160 }}>
            Bottom Ad
          </div>
        )}
      </section>
    </div>
  );
}
