'use client';

/**
 * useComputedBands — resolves each band's stored layout into px geometry + a
 * text-flow result, using the DOM measurer. Shared by the layout editor and the
 * print proof so both produce identical output. Recomputes when a band's
 * content or geometry changes (the editor mutates state on drop, not per
 * pixel), and again once web fonts have loaded.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTENT_W_PX,
  CONTENT_H_PX,
  COLUMN_GAP_PX,
  QUARTER_AD_W_PX,
  QUARTER_AD_H_PX,
  THIRD_AD_H_PX,
  estimateBodyHeight,
  layoutBand,
  photoRectPx,
  type BandGeometry,
  type CornerAd,
  type LayoutResult,
  type Measurer,
  type StoredStoryLayout,
  type StoredAdLayout,
} from './layout-engine';
import { createMeasurer, whenFontsReady } from './measurer';
import type { NpStoryData, NpAdData } from '@/lib/queries/newspaper';

/** A quarter-page ad folded into the story band above it: renders in the
 *  band's bottom exterior corner at the FIXED quarter-ad size with the text
 *  wrapping the open side. */
export type CornerAdInput = {
  side: 'left' | 'right';
  data: NpAdData;
};

export type BandInput = {
  id: string;
  type: 'story' | 'ad';
  data: NpStoryData & NpAdData;
  /** Normalised story layout (story bands). */
  story?: StoredStoryLayout;
  /** Normalised ad layout (ad bands). */
  ad?: StoredAdLayout;
  /** Present on a story band that absorbed a following quarter ad. */
  cornerAd?: CornerAdInput;
  /** Extra body height (px) beyond the auto-fit — ProofBands stretches the
   *  corner-ad band with this so the band bottom (and therefore the ad)
   *  lands exactly on the page bottom. */
  stretchPx?: number;
};

/** Fold a trailing QUARTER ad into the story band immediately before it,
 *  anchored to the page's exterior corner (even pages left, odd pages right —
 *  the printed template's convention). Only the LAST item folds: the corner
 *  treatment pins the ad to the PAGE bottom, which only makes sense at the end
 *  of the stack. A quarter ad elsewhere (or with no story above it) keeps the
 *  legacy full-width-band rendering. Other sizes are untouched. */
export function mergeQuarterAds(inputs: BandInput[], exteriorSide: 'left' | 'right'): BandInput[] {
  // A quarter-page ad ALWAYS occupies the page's bottom EXTERIOR corner (even
  // pages left, odd pages right), with the article wrapping around it. Pull the
  // first quarter ad out of the flow — wherever the editor placed it in the item
  // list — and fold it into the LAST story band (the one that reaches the page
  // bottom). ProofBands then stretches that band so the ad pins to the page
  // bottom corner. This is unconditional: the ad no longer has to be the last
  // item with a story directly above it.
  const adIdx = inputs.findIndex((it) => it.type === 'ad' && it.ad?.size === 'quarter');
  if (adIdx === -1) return inputs;
  const rest = inputs.filter((_, i) => i !== adIdx);
  let storyIdx = -1;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (rest[i].type === 'story' && !rest[i].cornerAd) {
      storyIdx = i;
      break;
    }
  }
  // No story on the page to wrap around (e.g. an ad-only page) — leave the ad as
  // an ordinary band rather than dropping it.
  if (storyIdx === -1) return inputs;
  const ad = inputs[adIdx];
  return rest.map((it, i) =>
    i === storyIdx ? { ...it, cornerAd: { side: exteriorSide, data: ad.data } } : it
  );
}

/** A THIRD-page ad is a fixed-size full-width strip pinned to the PAGE BOTTOM:
 *  move the first third ad to the end of the stack — ProofBands then stretches
 *  the last story band so the strip's bottom edge lands on the page bottom. */
export function mergeThirdAds(inputs: BandInput[]): BandInput[] {
  const i = inputs.findIndex((it) => it.type === 'ad' && it.ad?.size === 'third');
  if (i === -1 || i === inputs.length - 1) return inputs;
  return [...inputs.filter((_, j) => j !== i), inputs[i]];
}

/** If the photo's columns intersect the corner ad's columns, shift the photo
 *  to the ad's OPEN side (clamping its span to the open columns) — otherwise
 *  the ad creative draws over the photo. Text runs already avoid both rects. */
function shiftPhotoClearOfAd(
  photo: ReturnType<typeof photoRectPx>,
  ad: CornerAd,
  columns: number,
  contentWidthPx: number,
  gapPx: number
): ReturnType<typeof photoRectPx> {
  const overlaps =
    photo.colStart0 < ad.colStart0 + ad.colSpan && ad.colStart0 < photo.colStart0 + photo.colSpan;
  if (!overlaps) return photo;
  const openStart = ad.colStart0 === 0 ? ad.colSpan : 0;
  const openCount = columns - ad.colSpan;
  if (openCount < 1) return photo;
  const colSpan = Math.min(photo.colSpan, openCount);
  const colStart0 = Math.min(Math.max(photo.colStart0, openStart), openStart + openCount - colSpan);
  const w = (contentWidthPx - (columns - 1) * gapPx) / columns;
  const left = colStart0 * (w + gapPx);
  const width = colSpan * w + (colSpan - 1) * gapPx;
  return { ...photo, colStart0, colSpan, left, width };
}

/** Resolve a story band's corner ad: the creative gets the FIXED quarter-ad
 *  pixel rect anchored to the exterior side; the text-exclusion columns are
 *  whichever columns that rect overlaps. Size never varies with column count,
 *  content width, or the page fit levers. */
function cornerAdRect(input: BandInput, columns: number, contentWidthPx: number): CornerAd | null {
  if (!input.cornerAd) return null;
  const widthPx = Math.min(QUARTER_AD_W_PX, contentWidthPx);
  const heightPx = QUARTER_AD_H_PX;
  const leftPx = input.cornerAd.side === 'left' ? 0 : contentWidthPx - widthPx;
  const colW = (contentWidthPx - (columns - 1) * COLUMN_GAP_PX) / columns;
  let colStart0 = columns;
  let colEnd = -1;
  for (let c = 0; c < columns; c++) {
    const l = c * (colW + COLUMN_GAP_PX);
    const r = l + colW;
    if (r > leftPx + 0.5 && l < leftPx + widthPx - 0.5) {
      colStart0 = Math.min(colStart0, c);
      colEnd = Math.max(colEnd, c);
    }
  }
  if (colEnd < colStart0) {
    colStart0 = input.cornerAd.side === 'left' ? 0 : columns - 1;
    colEnd = colStart0;
  }
  return { leftPx, widthPx, heightPx, colStart0, colSpan: colEnd - colStart0 + 1 };
}

export type ComputedBand = {
  id: string;
  geometry: BandGeometry;
  layoutResult: LayoutResult | null;
  adHeightPx?: number;
};

function computeStory(
  input: BandInput,
  contentWidthPx: number,
  measurer: Measurer
): ComputedBand {
  const layout = input.story!;
  const cornerAd = cornerAdRect(input, layout.column_count, contentWidthPx);
  let photo =
    layout.photo && input.data.hero_photo_url
      ? photoRectPx(layout.photo, contentWidthPx, layout.column_count, COLUMN_GAP_PX)
      : null;
  if (photo && cornerAd) {
    photo = shiftPhotoClearOfAd(photo, cornerAd, layout.column_count, contentWidthPx, COLUMN_GAP_PX);
  }
  const base = {
    contentWidthPx,
    columns: layout.column_count,
    gapPx: COLUMN_GAP_PX,
    photo,
    cornerAd,
  };
  const bodyHeightPx =
    (layout.band_height != null
      ? layout.band_height * CONTENT_H_PX
      : estimateBodyHeight(input.data.body, base, measurer)) + (input.stretchPx ?? 0);
  const geometry: BandGeometry = { ...base, bodyHeightPx };
  const layoutResult = layoutBand(input.data.body, geometry, measurer);
  return { id: input.id, geometry, layoutResult };
}

/** SSR-safe story geometry without the DOM measurer (no text flow). The client
 *  re-computes with the real measurer on mount. */
function computeStorySsr(input: BandInput, contentWidthPx: number): ComputedBand {
  const layout = input.story!;
  const cornerAd = cornerAdRect(input, layout.column_count, contentWidthPx);
  let photo =
    layout.photo && input.data.hero_photo_url
      ? photoRectPx(layout.photo, contentWidthPx, layout.column_count, COLUMN_GAP_PX)
      : null;
  if (photo && cornerAd) {
    photo = shiftPhotoClearOfAd(photo, cornerAd, layout.column_count, contentWidthPx, COLUMN_GAP_PX);
  }
  const bodyHeightPx = (layout.band_height ?? 0.1) * CONTENT_H_PX + (input.stretchPx ?? 0);
  return {
    id: input.id,
    geometry: {
      contentWidthPx,
      bodyHeightPx,
      columns: layout.column_count,
      gapPx: COLUMN_GAP_PX,
      photo,
      cornerAd,
    },
    layoutResult: null,
  };
}

function computeAd(input: BandInput, contentWidthPx: number): ComputedBand {
  // Quarter and third ads are FIXED sizes — the stored height fraction is
  // ignored so they can never fluctuate with the page's fit levers. (A
  // standalone quarter band only occurs on a story-less page; it still gets
  // the fixed height.) Half/full keep the stored-fraction behavior.
  const size = input.ad?.size;
  const adHeightPx =
    size === 'third'
      ? THIRD_AD_H_PX
      : size === 'quarter'
      ? QUARTER_AD_H_PX
      : (input.ad?.height ?? 0.23) * CONTENT_H_PX;
  return {
    id: input.id,
    geometry: { contentWidthPx, bodyHeightPx: adHeightPx, columns: 1, gapPx: COLUMN_GAP_PX, photo: null },
    layoutResult: null,
    adHeightPx,
  };
}

/** Stable signature of the inputs that affect computed geometry. */
function signature(inputs: BandInput[]): string {
  return JSON.stringify(
    inputs.map((i) => [
      i.id,
      i.type,
      i.data.body ?? '',
      i.data.hero_photo_url ?? '',
      i.story ? [i.story.column_count, i.story.band_height, i.story.photo] : null,
      i.ad ? [i.ad.size, i.ad.height] : null,
      i.cornerAd ? [i.cornerAd.side, i.cornerAd.data.storage_path ?? ''] : null,
      i.stretchPx ?? 0,
    ])
  );
}

export function useComputedBands(
  inputs: BandInput[],
  contentWidthPx: number = CONTENT_W_PX
): { computed: ComputedBand[]; ready: boolean } {
  const measurerRef = useRef<Measurer | null>(null);
  if (measurerRef.current === null) measurerRef.current = createMeasurer();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    whenFontsReady().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const sig = signature(inputs);
  const computed = useMemo(() => {
    // No DOM on the server — return placeholder geometry; the client re-runs
    // the measurer on mount (and that's the render Playwright captures).
    const hasDom = typeof document !== 'undefined';
    const measurer = measurerRef.current!;
    return inputs.map((input) =>
      input.type === 'ad'
        ? computeAd(input, contentWidthPx)
        : hasDom
        ? computeStory(input, contentWidthPx, measurer)
        : computeStorySsr(input, contentWidthPx)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, contentWidthPx, ready]);

  return { computed, ready };
}
