'use client';

/**
 * ProofBands — client wrapper that flows the page's stored geometry through the
 * shared layout engine + BandRenderer, so the print proof reproduces exactly
 * what the visual editor showed. Measurement is client-side (DOM), so this is a
 * client component the server proof page mounts.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeStoryLayout,
  normalizeAdLayout,
  CONTENT_W_PX,
  CONTENT_H_PX,
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
  onTextOverflow,
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
  /** Editor affordance: reports whether any story's text failed to fit its
   *  band (the pour trims the remainder at the page edge — invisible unless
   *  surfaced). Never rendered; the print output is unchanged. */
  onTextOverflow?: (overflowing: boolean) => void;
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
  const merged = useMemo(
    () => mergeQuarterAds(rawInputs, exteriorSide),
    [rawInputs, exteriorSide]
  );

  // A corner-ad band must END at the page bottom (the ad is pinned to the
  // band's bottom edge). The call sites give this component the full
  // remaining page height via flex; measure it and stretch the corner band's
  // body until the stack fills it. When the parent doesn't stretch us
  // (legacy layouts), clientHeight equals the content height and the delta
  // is ~0 — a safe no-op.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [stretchPx, setStretchPx] = useState(0);
  const gapPx = Math.max(4, Math.round(14 * spaceScale));
  const cornerBandId = merged.length > 0 && merged[merged.length - 1].cornerAd ? merged[merged.length - 1].id : null;

  const inputs = useMemo(
    () =>
      cornerBandId && stretchPx > 0
        ? merged.map((it) => (it.id === cornerBandId ? { ...it, stretchPx } : it))
        : merged,
    [merged, cornerBandId, stretchPx]
  );
  const { computed, ready } = useComputedBands(inputs, contentWidthPx);
  const byId = useMemo(() => Object.fromEntries(computed.map((c) => [c.id, c])), [computed]);

  // Report text overflow (a pour that ran out of room trims silently) so the
  // page editor can warn and the spacing/photo/columns tools get used.
  const lastOverflow = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!onTextOverflow || !ready) return;
    const over = computed.some((c) => c.layoutResult !== null && !c.layoutResult.fits);
    if (lastOverflow.current !== over) {
      lastOverflow.current = over;
      onTextOverflow(over);
    }
  }, [computed, ready, onTextOverflow]);

  useLayoutEffect(() => {
    if (!cornerBandId || !ready) return;
    const root = rootRef.current;
    if (!root) return;
    const kids = Array.from(root.children) as HTMLElement[];
    if (kids.length === 0) return;
    const total = kids.reduce((s, el) => s + el.offsetHeight, 0) + gapPx * (kids.length - 1);
    const avail = root.clientHeight;
    const delta = avail - total;
    if (delta > 4) {
      setStretchPx((s) => Math.min(CONTENT_H_PX, s + delta));
    } else if (delta < -4 && stretchPx > 0) {
      setStretchPx((s) => Math.max(0, s + delta));
    }
  }, [cornerBandId, ready, computed, gapPx, stretchPx]);

  return (
    // Tighter inter-story spacing (was a loose 24px gap); a thin rule + small
    // gap reads more like a newspaper. Scaled by the page's spacing lever.
    // flex:1 lets a fixed-height parent hand us the remaining page height for
    // the corner-ad stretch; in an auto-height parent it has no effect.
    <div
      ref={rootRef}
      className="flex flex-col"
      style={{ width: contentWidthPx, gap: gapPx, flex: '1 1 0%', minHeight: 0 }}
    >
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
