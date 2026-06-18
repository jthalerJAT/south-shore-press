'use client';

/**
 * PageTwo — to-scale renderer for the Page 2 ("OpEd") template. The Main OpEd
 * and Second Story bodies flow through the shared column engine (BandRenderer +
 * useComputedBands) so the embedded photo can sit at the top of specific
 * columns (cols 2–3 for the 4-column OpEd, col 2 for the 3-column second story)
 * with the text wrapping around it. Shared by the editor preview, View File,
 * and the print proof.
 */
import { CONTENT_W_PX, CONTENT_H_PX, type StoredStoryLayout } from '@/lib/newspaper/layout-engine';
import { useComputedBands, type BandInput } from '@/lib/newspaper/use-bands';
import { adFilePublicUrl } from '@/lib/ad-files';
import { BandRenderer } from './band-renderer';
import { PageHeader } from './page-header';
import type { OpEdData } from '@/lib/newspaper/oped';

const BLUE = '#1e3a8a';

function storyLayout(
  columns: number,
  colStart: number,
  colSpan: number,
  heightFrac: number,
  hasPhoto: boolean
): StoredStoryLayout {
  return {
    v: 1,
    kind: 'story',
    band_index: 0,
    column_count: columns,
    band_height: null,
    photo: hasPhoto ? { mode: 'column', col_start: colStart, col_span: colSpan, top: 0, height: heightFrac } : null,
  };
}

function BlueFlag({ columnName, author, photoUrl }: { columnName?: string; author?: string; photoUrl?: string }) {
  const FLAG_H = 72;
  return (
    <div className="flex items-stretch shrink-0" style={{ height: FLAG_H }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" style={{ width: FLAG_H, height: FLAG_H, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: FLAG_H, height: FLAG_H, background: '#c7d2fe' }} />
      )}
      {/* Blue parallelogram with the slanted right edge */}
      <div
        className="flex flex-col justify-center leading-tight"
        style={{
          background: BLUE,
          color: '#fff',
          paddingLeft: 14,
          paddingRight: 36,
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 20px) 100%, 0 100%)',
        }}
      >
        <span style={{ fontSize: 14, fontStyle: 'italic' }}>From the</span>
        <span className="font-headline" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
          {columnName || 'NEWSROOM'}
        </span>
        <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>BY {(author || '—').toUpperCase()}</span>
      </div>
      {/* Trailing diagonal stripes */}
      <div className="flex items-stretch" style={{ marginLeft: 3, gap: 3 }}>
        <div style={{ width: 16, background: BLUE, transform: 'skewX(-22deg)' }} />
        <div style={{ width: 9, background: BLUE, transform: 'skewX(-22deg)' }} />
      </div>
    </div>
  );
}

export function PageTwo({
  data,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: OpEdData;
  pageNumber: number;
  dateLabel?: string;
  /** Editor preview shows the empty-ad placeholder; the final proof/View File
   *  / InDesign output show only a placed ad (no label, no box). */
  editing?: boolean;
}) {
  // The second story's byline leads column 1 (top-aligned with the photo + the
  // other columns), so prepend it to the body the engine flows.
  const secondBody = data.second.author
    ? `By ${data.second.author}\n\n${data.second.text ?? ''}`
    : data.second.text ?? '';

  const inputs: BandInput[] = [
    {
      id: 'oped',
      type: 'story',
      data: { body: data.main.text ?? '', hero_photo_url: data.main.photo_url ?? '' },
      story: storyLayout(4, 2, 2, 0.2, Boolean(data.main.photo_url)),
    },
    {
      id: 'second',
      type: 'story',
      data: { body: secondBody, hero_photo_url: data.second.photo_url ?? '' },
      story: storyLayout(3, 2, 1, 0.14, Boolean(data.second.photo_url)),
    },
  ];
  const { computed } = useComputedBands(inputs, CONTENT_W_PX);
  const oped = computed[0];
  const second = computed[1];

  const adUrl = data.bottom_ad?.storage_path ? adFilePublicUrl(data.bottom_ad.storage_path) : null;

  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, minHeight: CONTENT_H_PX, background: '#fff', color: '#111' }}
    >
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />

      {/* ── Main OpEd ─────────────────────────────────────── */}
      <section>
        {/* Headline sits beside the blue flag */}
        <div className="flex items-center gap-6" style={{ marginBottom: 22 }}>
          <BlueFlag columnName={data.main.column_name} author={data.main.author} photoUrl={data.main.author_photo_url} />
          <h2
            className="text-center"
            style={{ fontFamily: 'var(--font-crimson)', fontSize: 48, fontWeight: 700, lineHeight: 1.04, color: BLUE, flex: 1 }}
          >
            {data.main.title || <span style={{ color: '#d4d4d8' }}>[OpEd Title]</span>}
          </h2>
        </div>
        {oped ? (
          <BandRenderer
            type="story"
            hideHeader
            data={{ body: data.main.text ?? '', hero_photo_url: data.main.photo_url ?? '' }}
            geometry={oped.geometry}
            layoutResult={oped.layoutResult}
            photoCaption={data.main.photo_caption}
            photoCredit={data.main.photo_credit}
          />
        ) : null}
      </section>

      <div style={{ borderTop: '1px solid #000', margin: '16px 0' }} />

      {/* ── Second Story ──────────────────────────────────── */}
      <section>
        <h3 style={{ fontFamily: 'var(--font-crimson)', fontSize: 36, fontWeight: 700, lineHeight: 1.03, color: BLUE, marginBottom: 10 }}>
          {data.second.headline || <span style={{ color: '#d4d4d8' }}>[Second Story Headline]</span>}
        </h3>
        {second ? (
          <BandRenderer
            type="story"
            hideHeader
            bylineLead={Boolean(data.second.author)}
            data={{ body: secondBody, hero_photo_url: data.second.photo_url ?? '' }}
            geometry={second.geometry}
            layoutResult={second.layoutResult}
            photoCaption={data.second.photo_caption}
            photoCredit={data.second.photo_credit}
          />
        ) : null}
        {data.second.extra_photo_url ? (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.second.extra_photo_url} alt="" style={{ width: 240, objectFit: 'cover', background: '#e4e4e7' }} />
          </div>
        ) : null}
      </section>

      {/* ── Bottom Ad ─────────────────────────────────────── */}
      {adUrl ? (
        <section className="mt-auto">
          <div style={{ borderTop: `3px solid ${BLUE}`, margin: '0 0 12px' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={adUrl} alt={data.bottom_ad?.file_name ?? ''} style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }} />
        </section>
      ) : editing ? (
        <section className="mt-auto">
          <div style={{ borderTop: `3px solid ${BLUE}`, margin: '0 0 12px' }} />
          <div className="w-full border-2 border-dashed border-zinc-300 flex items-center justify-center text-sm text-zinc-400" style={{ height: 160 }}>
            Bottom Ad slot (editor only)
          </div>
        </section>
      ) : null}
    </div>
  );
}
