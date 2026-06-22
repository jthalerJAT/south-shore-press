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
import { adSizeLabel } from '@/lib/newspaper-templates';
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
  /** Skip the headline/byline header (the caller renders its own, e.g. Page 2). */
  hideHeader?: boolean;
  /** Style the very first paragraph (top of column 1) as a byline — bold
   *  italic, no indent. The caller prepends "By …" to the body. */
  bylineLead?: boolean;
  /** Caption (bottom-left) + credit (bottom-right) under the embedded photo.
   *  Space for them is reserved inside the photo's exclusion rect. */
  photoCaption?: string;
  photoCredit?: string;
};

/** Height reserved at the bottom of the photo rect for the caption/credit row. */
const PHOTO_CAPTION_STRIP = 16;
/** Navy used for interior-page story headlines, matching the printed paper. */
const HEADLINE_NAVY = '#1e3a8a';

export function BandRenderer({
  type,
  data,
  geometry,
  layoutResult,
  adHeightPx,
  children,
  adPublicUrl,
  hideHeader,
  bylineLead,
  photoCaption,
  photoCredit,
}: BandRenderProps) {
  if (type === 'ad') {
    return (
      <AdBand data={data} width={geometry.contentWidthPx} height={adHeightPx ?? 200} adPublicUrl={adPublicUrl} />
    );
  }
  return (
    <article style={{ width: geometry.contentWidthPx }}>
      {hideHeader ? null : <StoryHeader data={data} />}
      <div
        className="relative"
        style={{ width: geometry.contentWidthPx, height: geometry.bodyHeightPx }}
      >
        {(layoutResult?.runs ?? []).map((run, i) => (
          <div
            key={i}
            className="[&>p+p]:mt-1 overflow-hidden"
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
              ? run.text.split('\n\n').map((p, j) => {
                  const isByline = bylineLead && i === 0 && j === 0;
                  return (
                    <p
                      key={j}
                      style={
                        isByline
                          ? { margin: '0 0 6px', textIndent: 0, fontWeight: 700, fontStyle: 'italic', fontSize: 16 }
                          : { margin: 0, textIndent: '1.2em' }
                      }
                    >
                      {p}
                    </p>
                  );
                })
              : null}
          </div>
        ))}

        {geometry.photo && data.hero_photo_url
          ? (() => {
              const hasStrip = Boolean(photoCaption || photoCredit);
              const stripH = hasStrip ? PHOTO_CAPTION_STRIP : 0;
              const imgH = geometry.photo.height - stripH;
              return (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.hero_photo_url}
                    alt=""
                    style={{
                      position: 'absolute',
                      left: geometry.photo.left,
                      top: geometry.photo.top,
                      width: geometry.photo.width,
                      height: imgH,
                      objectFit: 'cover',
                      background: '#e4e4e7',
                    }}
                  />
                  {hasStrip ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: geometry.photo.left,
                        top: geometry.photo.top + imgH + 1,
                        width: geometry.photo.width,
                        height: stripH,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 9,
                        lineHeight: '11px',
                        color: '#52525b',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {photoCaption ?? ''}
                      </span>
                      {photoCredit ? <span style={{ whiteSpace: 'nowrap' }}>Credit: {photoCredit}</span> : null}
                    </div>
                  ) : null}
                </>
              );
            })()
          : null}

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

      {/* House style: navy, bold, centered headline spanning the band, with the
          byline as a bold-italic line below (matching the printed interior pages). */}
      <h2
        className="font-headline font-bold leading-tight text-center"
        style={{ fontSize: 32, color: HEADLINE_NAVY }}
      >
        {data.headline || <span className="text-zinc-300">[Headline]</span>}
      </h2>
      {data.subline ? (
        <p className="text-center text-zinc-600 italic" style={{ fontSize: 16 }}>{data.subline}</p>
      ) : null}
      {!data.blue_flag && data.byline ? (
        <p className="italic font-bold text-zinc-800 mt-1" style={{ fontSize: 14 }}>By {data.byline}</p>
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
  const sizeLabel = adSizeLabel(data.ad_size);
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
