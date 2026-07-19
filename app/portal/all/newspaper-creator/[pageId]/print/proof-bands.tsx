'use client';

/**
 * ProofBands — client wrapper that flows the page's stored geometry through the
 * shared layout engine + BandRenderer, so the print proof reproduces exactly
 * what the visual editor showed. Measurement is client-side (DOM), so this is a
 * client component the server proof page mounts.
 */
import { useMemo } from 'react';
import {
  normalizeStoryLayout,
  normalizeAdLayout,
  CONTENT_W_PX,
  MIN_COLUMNS,
  MAX_COLUMNS,
} from '@/lib/newspaper/layout-engine';
import { useComputedBands, mergeQuarterAds, type BandInput } from '@/lib/newspaper/use-bands';
import { BandRenderer } from '@/components/newspaper/band-renderer';
import type { NpStoryData, NpAdData } from '@/lib/queries/newspaper';

const ADS_BUCKET = 'newspaper-ads';
function adUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${ADS_BUCKET}/${path}`;
}

export type ProofItem = {
  id: string;
  type: 'story' | 'ad';
  data: NpStoryData & NpAdData;
  layout: Record<string, unknown>;
};

export function ProofBands({
  items,
  contentWidthPx = CONTENT_W_PX,
  photoScale = 1,
  spaceScale = 1,
  columns,
  pageOrdinal,
}: {
  items: ProofItem[];
  /** Render width for the bands — narrowed when a side rail shares the page. */
  contentWidthPx?: number;
  /** Page-level "fit" levers (set from the page editor's controls). */
  photoScale?: number;
  spaceScale?: number;
  /** When set, override every story band's column count (page-wide +/−). */
  columns?: number;
  /** Printed page number — quarter ads anchor to the EXTERIOR corner (even
   *  pages left, odd pages right, like the printed template). Omitted →
   *  right. */
  pageOrdinal?: number;
}) {
  const clampCols = (n: number) => Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(n)));
  const rawInputs: BandInput[] = useMemo(
    () =>
      items.map((it, i) => {
        // House style: the byline is the first line of column 1, top-aligned
        // with the other columns + the photo. Fold "By …" into the flowed body
        // so the engine measures + places it there (BandRenderer styles it).
        const byline = it.type === 'story' ? (it.data.byline ?? '').trim() : '';
        const body = byline ? `By ${byline}\n\n${it.data.body ?? ''}` : it.data.body ?? '';
        let story =
          it.type === 'story'
            ? normalizeStoryLayout(it.layout, i, Boolean(it.data.hero_photo_url))
            : undefined;
        if (story) {
          if (columns) story = { ...story, column_count: clampCols(columns) };
          if (story.photo && photoScale !== 1) {
            story = { ...story, photo: { ...story.photo, height: story.photo.height * photoScale } };
          }
        }
        return {
          id: it.id,
          type: it.type,
          data: { ...it.data, body },
          story,
          ad: it.type === 'ad' ? normalizeAdLayout(it.layout, i, it.data.ad_size ?? 'quarter') : undefined,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, photoScale, columns]
  );
  // Quarter ads fold into the story above them, anchored to the page's
  // exterior corner (even = left, odd = right).
  const exteriorSide: 'left' | 'right' =
    pageOrdinal != null && pageOrdinal % 2 === 0 ? 'left' : 'right';
  const inputs = useMemo(
    () => mergeQuarterAds(rawInputs, exteriorSide),
    [rawInputs, exteriorSide]
  );
  const { computed } = useComputedBands(inputs, contentWidthPx);
  const byId = useMemo(() => Object.fromEntries(computed.map((c) => [c.id, c])), [computed]);

  return (
    // Tighter inter-story spacing (was a loose 24px gap); a thin rule + small
    // gap reads more like a newspaper. Scaled by the page's spacing lever.
    <div className="flex flex-col" style={{ width: contentWidthPx, gap: Math.max(4, Math.round(14 * spaceScale)) }}>
      {inputs.map((it) => {
        const c = byId[it.id];
        if (!c) return null;
        return (
          <BandRenderer
            key={it.id}
            type={it.type}
            data={it.data}
            geometry={c.geometry}
            layoutResult={c.layoutResult}
            adHeightPx={c.adHeightPx}
            adPublicUrl={adUrl}
            bylineLead={it.type === 'story' && Boolean((it.data.byline ?? '').trim())}
            photoCaption={it.data.photo_caption}
            photoCredit={it.data.photo_credit}
            cornerAdData={it.cornerAd?.data}
          />
        );
      })}
    </div>
  );
}
