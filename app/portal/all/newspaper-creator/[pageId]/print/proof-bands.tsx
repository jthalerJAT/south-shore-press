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
} from '@/lib/newspaper/layout-engine';
import { useComputedBands, type BandInput } from '@/lib/newspaper/use-bands';
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
}: {
  items: ProofItem[];
  /** Render width for the bands — narrowed when a side rail shares the page. */
  contentWidthPx?: number;
}) {
  const inputs: BandInput[] = useMemo(
    () =>
      items.map((it, i) => ({
        id: it.id,
        type: it.type,
        data: it.data,
        story:
          it.type === 'story'
            ? normalizeStoryLayout(it.layout, i, Boolean(it.data.hero_photo_url))
            : undefined,
        ad: it.type === 'ad' ? normalizeAdLayout(it.layout, i, it.data.ad_size ?? 'quarter') : undefined,
      })),
    [items]
  );
  const { computed } = useComputedBands(inputs, contentWidthPx);
  const byId = useMemo(() => Object.fromEntries(computed.map((c) => [c.id, c])), [computed]);

  return (
    <div className="flex flex-col gap-6" style={{ width: contentWidthPx }}>
      {items.map((it) => {
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
          />
        );
      })}
    </div>
  );
}
