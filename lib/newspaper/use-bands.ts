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
  CORNER_QUARTER_HEIGHT_FRAC,
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
 *  band's bottom exterior corner with the text wrapping the open side. */
export type CornerAdInput = {
  side: 'left' | 'right';
  /** Ad rect height as a fraction of page content height. */
  heightFrac: number;
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
};

/** Fold every QUARTER ad into the story band immediately before it, anchored
 *  to the page's exterior corner (even pages left, odd pages right — the
 *  printed template's convention). A quarter ad with no story above it keeps
 *  the legacy full-width-band rendering. Other sizes are untouched. */
export function mergeQuarterAds(inputs: BandInput[], exteriorSide: 'left' | 'right'): BandInput[] {
  const out: BandInput[] = [];
  for (const input of inputs) {
    const prev = out[out.length - 1];
    if (
      input.type === 'ad' &&
      input.ad?.size === 'quarter' &&
      prev &&
      prev.type === 'story' &&
      !prev.cornerAd
    ) {
      out[out.length - 1] = {
        ...prev,
        cornerAd: { side: exteriorSide, heightFrac: CORNER_QUARTER_HEIGHT_FRAC, data: input.data },
      };
      continue;
    }
    out.push(input);
  }
  return out;
}

/** Resolve a story band's corner ad to whole columns on its anchored side. */
function cornerAdRect(input: BandInput, columns: number): CornerAd | null {
  if (!input.cornerAd) return null;
  const colSpan = Math.max(1, Math.round(columns / 2));
  const colStart0 = input.cornerAd.side === 'left' ? 0 : columns - colSpan;
  return { colStart0, colSpan, heightPx: input.cornerAd.heightFrac * CONTENT_H_PX };
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
  const photo =
    layout.photo && input.data.hero_photo_url
      ? photoRectPx(layout.photo, contentWidthPx, layout.column_count, COLUMN_GAP_PX)
      : null;
  const base = {
    contentWidthPx,
    columns: layout.column_count,
    gapPx: COLUMN_GAP_PX,
    photo,
    cornerAd: cornerAdRect(input, layout.column_count),
  };
  const bodyHeightPx =
    layout.band_height != null
      ? layout.band_height * CONTENT_H_PX
      : estimateBodyHeight(input.data.body, base, measurer);
  const geometry: BandGeometry = { ...base, bodyHeightPx };
  const layoutResult = layoutBand(input.data.body, geometry, measurer);
  return { id: input.id, geometry, layoutResult };
}

/** SSR-safe story geometry without the DOM measurer (no text flow). The client
 *  re-computes with the real measurer on mount. */
function computeStorySsr(input: BandInput, contentWidthPx: number): ComputedBand {
  const layout = input.story!;
  const photo =
    layout.photo && input.data.hero_photo_url
      ? photoRectPx(layout.photo, contentWidthPx, layout.column_count, COLUMN_GAP_PX)
      : null;
  const bodyHeightPx = (layout.band_height ?? 0.1) * CONTENT_H_PX;
  return {
    id: input.id,
    geometry: {
      contentWidthPx,
      bodyHeightPx,
      columns: layout.column_count,
      gapPx: COLUMN_GAP_PX,
      photo,
      cornerAd: cornerAdRect(input, layout.column_count),
    },
    layoutResult: null,
  };
}

function computeAd(input: BandInput, contentWidthPx: number): ComputedBand {
  const adHeightPx = (input.ad?.height ?? 0.23) * CONTENT_H_PX;
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
      i.cornerAd ? [i.cornerAd.side, i.cornerAd.heightFrac, i.cornerAd.data.storage_path ?? ''] : null,
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
