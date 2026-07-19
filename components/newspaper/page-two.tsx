'use client';

/**
 * PageTwo — to-scale renderer for the Page 2 ("OpEd") template. The Main OpEd
 * and Second Story bodies flow through the shared column engine (BandRenderer +
 * useComputedBands) so the embedded photo can sit at the top of specific
 * columns (cols 2–3 for the 4-column OpEd, col 2 for the 3-column second story)
 * with the text wrapping around it. Shared by the editor preview, View File,
 * and the print proof.
 */
import { CONTENT_W_PX, CONTENT_H_PX, MIN_COLUMNS, MAX_COLUMNS, type StoredStoryLayout } from '@/lib/newspaper/layout-engine';
import { useComputedBands, type BandInput } from '@/lib/newspaper/use-bands';
import { adFilePublicUrl } from '@/lib/ad-files';
import { AdCopyView } from './ad-copy';
import { BandRenderer } from './band-renderer';
import { PageHeader } from './page-header';
import { OPED_MAIN_COLUMNS, OPED_SECOND_COLUMNS, type OpEdData } from '@/lib/newspaper/oped';

const clampCols = (n: number) => Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(n)));

const BLUE = '#1e3a8a';

function storyLayout(
  columns: number,
  colStart: number,
  colSpan: number,
  heightFrac: number,
  hasPhoto: boolean
): StoredStoryLayout {
  // Keep the photo within the column range when the column count changes.
  const span = Math.min(colSpan, columns);
  const start = Math.min(colStart, columns - span + 1);
  return {
    v: 1,
    kind: 'story',
    band_index: 0,
    column_count: columns,
    band_height: null,
    // Nudge the photo top down to the text cap-height so it lines up straight
    // across with the byline / first line of column 1 (not the box top).
    photo: hasPhoto ? { mode: 'column', col_start: start, col_span: span, top: 0.004, height: heightFrac } : null,
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

/** The bottom-ad slot's fixed share of the page: rule + gap + creative
 *  together take exactly the bottom 30% (publisher direction 2026-07-19). */
const AD_SECTION_H = Math.round(CONTENT_H_PX * 0.3);

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
   *  show only a placed ad (no label, no box). */
  editing?: boolean;
}) {
  // The second story's byline leads column 1 (top-aligned with the photo + the
  // other columns), so prepend it to the body the engine flows.
  const secondBody = data.second.author
    ? `By ${data.second.author}\n\n${data.second.text ?? ''}`
    : data.second.text ?? '';

  const ps = data.photo_scale ?? 1;
  // Vertical spacing lever: scale the inter-article gaps, never below a floor.
  const ss = data.space_scale ?? 1;
  const gap = (base: number, min: number) => Math.max(min, Math.round(base * ss));
  const flagGap = gap(16, 8);
  const dividerGap = gap(12, 4);
  const headlineGap = gap(8, 4);
  const adGap = gap(12, 6);
  const mainCols = clampCols(data.main.columns ?? OPED_MAIN_COLUMNS);
  const secondCols = clampCols(data.second.columns ?? OPED_SECOND_COLUMNS);
  const inputs: BandInput[] = [
    {
      id: 'oped',
      type: 'story',
      data: { body: data.main.text ?? '', hero_photo_url: data.main.photo_url ?? '' },
      story: storyLayout(mainCols, 2, 2, 0.2 * ps, Boolean(data.main.photo_url)),
    },
    {
      id: 'second',
      type: 'story',
      data: { body: secondBody, hero_photo_url: data.second.photo_url ?? '' },
      story: storyLayout(secondCols, 2, 1, 0.14 * ps, Boolean(data.second.photo_url)),
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
        <div className="flex items-center gap-6" style={{ marginBottom: flagGap }}>
          <BlueFlag columnName={data.main.column_name} author={data.main.author} photoUrl={data.main.author_photo_url} />
          <h2
            className="text-center"
            style={{ fontFamily: "var(--font-news-headline), 'Helvetica Neue', Arial, sans-serif", fontSize: 44, fontWeight: 800, lineHeight: 1.04, color: BLUE, flex: 1, whiteSpace: 'pre-line' }}
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

      <div style={{ borderTop: '1px solid #000', margin: `${dividerGap}px 0` }} />

      {/* ── Second Story ──────────────────────────────────── */}
      <section>
        <h3 className="text-center" style={{ fontFamily: "var(--font-news-headline), 'Helvetica Neue', Arial, sans-serif", fontSize: 34, fontWeight: 800, lineHeight: 1.03, color: BLUE, marginBottom: headlineGap, whiteSpace: 'pre-line' }}>
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
      {/* FIXED at 30% of the page (publisher direction 2026-07-19) — the slot
          no longer flexes into whatever the stories leave over (short copy was
          ballooning the ad to half a page). marginTop:auto pins it to the page
          bottom; any slack opens between the stories and the ad, and editors
          absorb it with the spacing/columns controls above. */}
      {adUrl ? (
        <section
          className="flex flex-col"
          style={{ flex: '0 0 auto', height: AD_SECTION_H, marginTop: 'auto', paddingTop: adGap }}
        >
          <div style={{ borderTop: `3px solid ${BLUE}`, margin: `0 0 ${adGap}px`, flexShrink: 0 }} />
          <AdCopyView
            src={adUrl}
            fileName={data.bottom_ad?.file_name}
            storagePath={data.bottom_ad?.storage_path}
            style={{ width: '100%', flex: '1 1 0%', minHeight: 0, objectFit: 'fill' }}
          />
        </section>
      ) : editing ? (
        <section
          className="flex flex-col"
          style={{ flex: '0 0 auto', height: AD_SECTION_H, marginTop: 'auto', paddingTop: adGap }}
        >
          <div style={{ borderTop: `3px solid ${BLUE}`, margin: `0 0 ${adGap}px`, flexShrink: 0 }} />
          <div className="w-full border-2 border-dashed border-zinc-300 flex items-center justify-center text-sm text-zinc-400" style={{ flex: '1 1 0%', minHeight: 0 }}>
            Bottom Ad slot (editor only)
          </div>
        </section>
      ) : null}
    </div>
  );
}
