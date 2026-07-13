'use client';

/**
 * PageFour — to-scale renderer for the Page 4 ("Op-Ed Page") template:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [running head]                                 │
 *   │ ╱OP-ED╱  Top headline ……………………                │
 *   │ By Author │ body 3 cols … │ [photo+caption]    │
 *   │ ───────────────────────  (full-width top body) │
 *   │ ┌──────────┐  ──────────────  ← divider = ad top│
 *   │ │ quarter  │  ╱OP-ED╱ Bottom headline           │
 *   │ │ page ad  │  By Author │ 2 cols │ [photo]      │
 *   │ └──────────┘                                    │
 *   └──────────────────────────────────────────────┘
 *
 * Headline + flag type sizes match the printed paper (Proxima Nova → our
 * Montserrat `--font-news-headline`): top headline 27pt≈36px, bottom 23pt≈31px,
 * flag 16pt≈22px; byline Crimson bold-italic 12pt≈16px; body Crimson 10.5pt.
 * Shared by the editor preview, View File, and the print proof.
 */
import { CONTENT_W_PX, CONTENT_H_PX, MIN_COLUMNS, MAX_COLUMNS, type StoredStoryLayout } from '@/lib/newspaper/layout-engine';
import { useComputedBands, type BandInput } from '@/lib/newspaper/use-bands';
import { adFilePublicUrl } from '@/lib/ad-files';
import { AdCopyView } from './ad-copy';
import { BandRenderer } from './band-renderer';
import { PageHeader } from './page-header';
import { PAGE_FOUR_TOP_COLUMNS, PAGE_FOUR_BOTTOM_COLUMNS, type PageFourData, type PageFourArticle } from '@/lib/newspaper/page-four';

const NAVY = '#1e3a8a';
const HEADLINE_FONT = "var(--font-news-headline), 'Helvetica Neue', Arial, sans-serif";

// Bottom row geometry: a quarter-page ad on the left, the 2-col article right.
const BOTTOM_GAP = 24;
const AD_W = 456; // ≈ 4.75in — quarter-page width
const AD_H = 672; // ≈ 7in — quarter-page height
const BOTTOM_ARTICLE_W = CONTENT_W_PX - AD_W - BOTTOM_GAP; // ≈ 480px

const clampCols = (n: number) => Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(n)));

function storyLayout(
  columns: number,
  colStart: number,
  colSpan: number,
  heightFrac: number,
  hasPhoto: boolean
): StoredStoryLayout {
  const span = Math.min(colSpan, columns);
  const start = Math.min(colStart, columns - span + 1);
  return {
    v: 1,
    kind: 'story',
    band_index: 0,
    column_count: columns,
    band_height: null,
    photo: hasPhoto ? { mode: 'column', col_start: start, col_span: span, top: 0.004, height: heightFrac } : null,
  };
}

function PageFlag({ label }: { label?: string }) {
  const text = (label ?? '').trim();
  if (!text) return null;
  return (
    <span style={{ background: NAVY, transform: 'skewX(-10deg)', display: 'inline-block', padding: '3px 16px', flexShrink: 0 }}>
      <span
        style={{
          display: 'inline-block',
          transform: 'skewX(10deg)',
          color: '#fff',
          fontFamily: HEADLINE_FONT,
          fontWeight: 600,
          textTransform: 'uppercase',
          fontSize: 22,
          lineHeight: 1.15,
          letterSpacing: '0.02em',
        }}
      >
        {text}
      </span>
    </span>
  );
}

/** Body with the byline folded in as the top-justified lead of column 1. */
function bodyWithByline(a: PageFourArticle): string {
  return a.author ? `By ${a.author}\n\n${a.text ?? ''}` : a.text ?? '';
}

export function PageFour({
  data,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: PageFourData;
  pageNumber: number;
  dateLabel?: string;
  /** Editor preview shows the empty-ad placeholder; the proof shows only a
   *  placed ad. */
  editing?: boolean;
}) {
  const ps = data.photo_scale ?? 1;
  const ss = data.space_scale ?? 1;
  const gap = (base: number, min: number) => Math.max(min, Math.round(base * ss));
  const headlineGap = gap(10, 5);
  const sectionGap = gap(16, 8);

  const topCols = clampCols(data.top.columns ?? PAGE_FOUR_TOP_COLUMNS);
  const bottomCols = clampCols(data.bottom.columns ?? PAGE_FOUR_BOTTOM_COLUMNS);

  // Top article flows full content width; bottom article flows in the narrower
  // right column beside the ad. Two separate band computations (two widths).
  const topInputs: BandInput[] = [
    {
      id: 'top',
      type: 'story',
      data: { body: data.top.text ?? '', hero_photo_url: data.top.photo_url ?? '' },
      story: storyLayout(topCols, topCols, 1, 0.18 * ps, Boolean(data.top.photo_url)),
    },
  ];
  const bottomBody = bodyWithByline(data.bottom);
  const bottomInputs: BandInput[] = [
    {
      id: 'bottom',
      type: 'story',
      data: { body: bottomBody, hero_photo_url: data.bottom.photo_url ?? '' },
      story: storyLayout(bottomCols, bottomCols, 1, 0.16 * ps, Boolean(data.bottom.photo_url)),
    },
  ];
  const { computed: topComputed } = useComputedBands(topInputs, CONTENT_W_PX);
  const { computed: bottomComputed } = useComputedBands(bottomInputs, BOTTOM_ARTICLE_W);
  const top = topComputed[0];
  const bottom = bottomComputed[0];

  const topBody = bodyWithByline(data.top);
  const adUrl = data.ad?.storage_path ? adFilePublicUrl(data.ad.storage_path) : null;

  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, minHeight: CONTENT_H_PX, background: '#fff', color: '#111' }}
    >
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />

      {/* ── Top article (full width) ──────────────────────── */}
      <section>
        {/* Headline is centered in the space to the RIGHT of the flag and its
            top lines up with the top of the flag (items-start). */}
        <div className="flex items-start" style={{ gap: 16, marginBottom: headlineGap }}>
          <PageFlag label={data.top.flag_label} />
          <h2
            style={{ fontFamily: HEADLINE_FONT, fontSize: 36, fontWeight: 800, lineHeight: 1.04, color: NAVY, whiteSpace: 'pre-line', textAlign: 'center', flex: 1 }}
          >
            {data.top.headline || <span style={{ color: '#d4d4d8' }}>[Top Article Headline]</span>}
          </h2>
        </div>
        {top ? (
          <BandRenderer
            type="story"
            hideHeader
            bylineLead={Boolean(data.top.author)}
            data={{ body: topBody, hero_photo_url: data.top.photo_url ?? '' }}
            geometry={top.geometry}
            layoutResult={top.layoutResult}
            photoCaption={data.top.photo_caption}
            photoCredit={data.top.photo_credit}
          />
        ) : null}
      </section>

      {/* ── Bottom row: quarter-page ad (left) + article (right) ── */}
      <section className="flex" style={{ gap: BOTTOM_GAP, marginTop: sectionGap, flex: '1 1 0%' }}>
        {/* Lower-left quarter-page ad. Its TOP edge is the reference the bottom
            article's dividing line aligns to (both start at this section's top). */}
        <div style={{ width: AD_W, flexShrink: 0 }}>
          {adUrl ? (
            <AdCopyView
              src={adUrl}
              fileName={data.ad?.file_name}
              storagePath={data.ad?.storage_path}
              style={{ width: AD_W, height: AD_H, objectFit: 'fill' }}
            />
          ) : editing ? (
            <div
              className="border-2 border-dashed border-zinc-300 flex items-center justify-center text-sm text-zinc-400 text-center"
              style={{ width: AD_W, height: AD_H }}
            >
              Quarter-page ad slot
              <br />
              (editor only)
            </div>
          ) : null}
        </div>

        {/* Lower-right 2-column article. The dividing line sits at the very top,
            so it lines up with the top of the ad on the left. */}
        <div style={{ width: BOTTOM_ARTICLE_W, flexShrink: 0 }}>
          <div style={{ borderTop: '1.5px solid #000', marginBottom: headlineGap }} />
          <div className="flex items-start" style={{ gap: 12, marginBottom: headlineGap }}>
            <PageFlag label={data.bottom.flag_label} />
            <h3
              style={{ fontFamily: HEADLINE_FONT, fontSize: 30, fontWeight: 800, lineHeight: 1.04, color: NAVY, whiteSpace: 'pre-line', textAlign: 'center', flex: 1 }}
            >
              {data.bottom.headline || <span style={{ color: '#d4d4d8' }}>[Bottom Article Headline]</span>}
            </h3>
          </div>
          {bottom ? (
            <BandRenderer
              type="story"
              hideHeader
              bylineLead={Boolean(data.bottom.author)}
              data={{ body: bottomBody, hero_photo_url: data.bottom.photo_url ?? '' }}
              geometry={bottom.geometry}
              layoutResult={bottom.layoutResult}
              photoCaption={data.bottom.photo_caption}
              photoCredit={data.bottom.photo_credit}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
