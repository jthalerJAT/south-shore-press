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
  estimateBodyHeight,
  layoutBand,
  photoRectPx,
  type BandGeometry,
  type LayoutResult,
  type Measurer,
  type StoredStoryLayout,
  type StoredAdLayout,
} from './layout-engine';
import { createMeasurer, whenFontsReady } from './measurer';
import type { NpStoryData, NpAdData } from '@/lib/queries/newspaper';

export type BandInput = {
  id: string;
  type: 'story' | 'ad';
  data: NpStoryData & NpAdData;
  /** Normalised story layout (story bands). */
  story?: StoredStoryLayout;
  /** Normalised ad layout (ad bands). */
  ad?: StoredAdLayout;
};

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
    geometry: { contentWidthPx, bodyHeightPx, columns: layout.column_count, gapPx: COLUMN_GAP_PX, photo },
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
