'use client';

/**
 * BandRenderer — the ONE presentational renderer for a newspaper story/ad band,
 * shared by the visual layout editor and the print proof so the PDF matches the
 * canvas exactly. Purely presentational: it's handed resolved px geometry + a
 * computed text-flow result (see useComputedBands / the layout engine) and just
 * draws. Interactive handles are layered on top via `children` by the editor.
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  BODY_FONT_FAMILY,
  BODY_FONT_SIZE_PX,
  BODY_LINE_HEIGHT_PX,
  type BandGeometry,
  type LayoutResult,
} from '@/lib/newspaper/layout-engine';
import type { NpStoryData, NpAdData } from '@/lib/queries/newspaper';

const runTextStyle: CSSProperties = {
  fontFamily: BODY_FONT_FAMILY,
  fontSize: `${BODY_FONT_SIZE_PX}px`,
  lineHeight: `${BODY_LINE_HEIGHT_PX}px`,
  textAlign: 'justify',
  color: '#18181b',
};

export type BandRenderProps = {
  type: 'story' | 'ad';
  data: NpStoryData & NpAdData;
  geometry: BandGeometry;
  /** Story text flow; null for ads. */
  layoutResult: LayoutResult | null;
  /** Ad block height in px (ad bands). */
  adHeightPx?: number;
  /** Editor overlay (photo handle, selection ring) drawn over the body. */
  children?: ReactNode;
  adPublicUrl?: (path: string) => string;
};

export function BandRenderer({
  type,
  data,
  geometry,
  layoutResult,
  adHeightPx,
  children,
  adPublicUrl,
}: BandRenderProps) {
  if (type === 'ad') {
    return (
      <AdBand data={data} width={geometry.contentWidthPx} height={adHeightPx ?? 200} adPublicUrl={adPublicUrl} />
    );
  }
  return (
    <article style={{ width: geometry.contentWidthPx }}>
      <StoryHeader data={data} />
      <div
        className="relative"
        style={{ width: geometry.contentWidthPx, height: geometry.bodyHeightPx }}
      >
        {(layoutResult?.runs ?? []).map((run, i) => (
          <div
            key={i}
            className="[&>p+p]:mt-2 overflow-hidden"
            style={{
              position: 'absolute',
              left: run.x,
              top: run.topPx,
              width: run.w,
              height: run.heightPx,
              ...runTextStyle,
            }}
          >
            {run.text
              ? run.text.split('\n\n').map((p, j) => (
                  <p key={j} style={{ margin: 0 }}>
                    {p}
                  </p>
                ))
              : null}
          </div>
        ))}

        {geometry.photo && data.hero_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.hero_photo_url}
            alt=""
            style={{
              position: 'absolute',
              left: geometry.photo.left,
              top: geometry.photo.top,
              width: geometry.photo.width,
              height: geometry.photo.height,
              objectFit: 'cover',
              background: '#e4e4e7',
            }}
          />
        ) : null}

        {children}
      </div>
    </article>
  );
}

function StoryHeader({ data }: { data: NpStoryData }) {
  return (
    <div className="mb-2">
      {data.blue_flag ? (
        <div className="flex items-center gap-3 bg-blue-800 text-white px-3 py-1.5 mb-2">
          {data.author_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.author_photo_url} alt="" className="w-10 h-10 rounded object-cover bg-white/20" />
          ) : null}
          <div className="leading-tight">
            {data.blue_flag_section ? (
              <div className="text-xs font-extrabold uppercase tracking-wide">
                {data.blue_flag_section}
              </div>
            ) : null}
            {data.byline ? (
              <div className="text-[10px] uppercase tracking-widest text-blue-100">By {data.byline}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <h2 className="font-headline font-bold text-zinc-900 leading-tight" style={{ fontSize: 26 }}>
        {data.headline || <span className="text-zinc-300">[Headline]</span>}
      </h2>
      {data.subline ? <p className="text-zinc-600" style={{ fontSize: 15 }}>{data.subline}</p> : null}
      {!data.blue_flag && data.byline ? (
        <p className="italic text-zinc-600" style={{ fontSize: 12 }}>By {data.byline}</p>
      ) : null}
    </div>
  );
}

function AdBand({
  data,
  width,
  height,
  adPublicUrl,
}: {
  data: NpAdData;
  width: number;
  height: number;
  adPublicUrl?: (path: string) => string;
}) {
  const sizeLabel =
    data.ad_size === 'full' ? 'Full Page' : data.ad_size === 'half' ? 'Half Page' : 'Quarter Page';
  const src = data.storage_path && adPublicUrl ? adPublicUrl(data.storage_path) : null;
  return (
    <div style={{ width }}>
      <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">
        Advertisement — {sizeLabel}
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={data.file_name ?? 'Advertisement'} className="border border-zinc-200" style={{ width, height, objectFit: 'contain' }} />
      ) : (
        <div
          className="border-2 border-dashed border-zinc-300 flex items-center justify-center text-sm text-zinc-400"
          style={{ width, height }}
        >
          Ad placeholder ({sizeLabel})
        </div>
      )}
    </div>
  );
}
