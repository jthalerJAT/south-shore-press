'use client';

/**
 * FunPage — renders a "Fun Stuff" page (Box Office / Puzzles / Funny Pages /
 * History):
 *   - our "Fun Stuff" section header on top,
 *   - the page pulled from the source app filling the space above the band
 *     (isolated in a srcdoc iframe so app CSS can't leak; the app's own reserved
 *     ad box is hidden),
 *   - a BOTTOM BAND of editor-added blocks — articles and ads — in left/right/
 *     full slots (a 1/4-page item is a half; a 1/3-page ad spans the full width).
 * Used by the editor preview, the per-page proof, View File, and the press print
 * route — so screen == print.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { adFilePublicUrl } from '@/lib/ad-files';
import { SectionFlag } from './section-flag';
import { FUN_SECTION_HEADER, funBlockIsFull, type FunPageData, type FunBlock } from '@/lib/newspaper/fun-page';

/** Native width of every Fun Stuff app's `#newspaperPage` node. */
const APP_PAGE_W = 780;
const FALLBACK_RATIO = 1.2;
/** Block band heights (approx page fractions). */
const BAND_FULL_H = Math.round(CONTENT_H_PX * 0.3); // ~1/3 page
const BAND_HALF_H = Math.round(CONTENT_H_PX * 0.24); // ~1/4 page

export function FunPage({
  data,
  sectionLabel = FUN_SECTION_HEADER,
  editing = false,
}: {
  data: FunPageData;
  sectionLabel?: string;
  editing?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [contentH, setContentH] = useState(APP_PAGE_W * FALLBACK_RATIO);

  const html = data.html ?? '';
  const css = data.css ?? '';
  const blocks = data.blocks ?? [];

  // App CSS first, then our overrides last so they reliably win: hide the app's
  // own reserved ad box (we place our own ads in the bottom band).
  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">` +
      `<style>html,body{margin:0;padding:0;background:#fff}</style>` +
      `<style>${css}</style>` +
      `<style>.ad-section,.ad-slot,.advertisement{display:none!important}</style>` +
      `</head><body>${html}</body></html>`
    : '';

  useLayoutEffect(() => {
    if (!html) return;
    const frame = frameRef.current;
    const area = areaRef.current;
    if (!frame || !area) return;
    function fit() {
      const area2 = areaRef.current;
      const frame2 = frameRef.current;
      if (!area2 || !frame2) return;
      let h = APP_PAGE_W * FALLBACK_RATIO;
      try {
        const doc = frame2.contentDocument;
        const node = doc?.getElementById('newspaperPage') ?? doc?.body ?? null;
        if (node && node.scrollHeight > 0) h = node.scrollHeight;
      } catch {
        /* srcdoc is same-origin; stay defensive */
      }
      // Fit to WIDTH so the pulled page fills the column edge-to-edge (no side
      // letterboxing). If it ends up taller than the area it clips at the bottom,
      // like a real print page.
      const availW = area2.clientWidth || CONTENT_W_PX;
      setContentH(h);
      setScale(availW / APP_PAGE_W);
    }
    frame.addEventListener('load', fit);
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 800);
    return () => {
      frame.removeEventListener('load', fit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [html, css]);

  return (
    <div
      style={{
        width: CONTENT_W_PX,
        height: CONTENT_H_PX,
        background: '#fff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SectionFlag label={sectionLabel} />

      {/* Pulled content — fills the space above the bottom band. */}
      <div ref={areaRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {html ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: `translateX(-50%) scale(${scale ?? CONTENT_W_PX / APP_PAGE_W})`,
              transformOrigin: 'top center',
              width: APP_PAGE_W,
              height: contentH,
              visibility: scale === null ? 'hidden' : 'visible',
            }}
          >
            <iframe
              ref={frameRef}
              srcDoc={srcDoc}
              title={sectionLabel}
              scrolling="no"
              style={{ width: APP_PAGE_W, height: contentH, border: 0, display: 'block' }}
            />
          </div>
        ) : editing ? (
          <div
            className="border-2 border-dashed border-zinc-300 text-zinc-400 text-sm flex items-center justify-center text-center px-6"
            style={{ width: '100%', height: '100%' }}
          >
            Nothing pulled yet — click “Pull from …” to generate this page.
          </div>
        ) : null}
      </div>

      {/* Bottom band — added articles + ads (left / right / full slots). */}
      {blocks.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            padding: '8px 0 0',
            borderTop: '1px solid #d4d4d8',
          }}
        >
          {blocks.map((b) => (
            <FunBlockView key={b.id} block={b} editing={editing} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FunBlockView({ block, editing }: { block: FunBlock; editing: boolean }) {
  const full = funBlockIsFull(block);
  const style: React.CSSProperties = {
    gridColumn: full ? '1 / -1' : block.slot === 'right' ? '2' : '1',
    minHeight: full ? BAND_FULL_H : BAND_HALF_H,
    overflow: 'hidden',
    background: '#fff',
  };

  if (block.kind === 'ad') {
    const src = block.ad_storage_path ? adFilePublicUrl(block.ad_storage_path) : null;
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={block.ad_file_name ?? 'Advertisement'}
            style={{ maxWidth: '100%', maxHeight: BAND_FULL_H, objectFit: 'contain' }}
          />
        ) : editing ? (
          <div
            className="m-1 border-2 border-dashed border-zinc-300 text-zinc-400 text-[11px] uppercase tracking-widest flex items-center justify-center text-center"
            style={{ width: '100%', height: '100%' }}
          >
            {block.ad_size === 'quarter' ? '1/4-page ad' : '1/3-page ad'} — from the Ad Database
          </div>
        ) : null}
      </div>
    );
  }

  // Article block.
  return (
    <div style={{ ...style, borderLeft: full ? undefined : '1px solid #e4e4e7', padding: '0 8px' }}>
      {block.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.photo_url}
          alt={block.headline ?? ''}
          style={{ width: '100%', maxHeight: Math.round(BAND_HALF_H * 0.5), objectFit: 'cover', marginBottom: 4 }}
        />
      ) : null}
      {block.headline ? (
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: full ? 18 : 15, lineHeight: 1.15, color: '#111' }}>
          {block.headline}
        </div>
      ) : editing ? (
        <div className="text-zinc-400 text-xs italic">Untitled article</div>
      ) : null}
      {block.byline ? (
        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 11, color: '#52525b', margin: '2px 0' }}>
          {block.byline}
        </div>
      ) : null}
      {block.body ? (
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 11, lineHeight: 1.35, color: '#27272a', overflow: 'hidden' }}>
          {block.body}
        </div>
      ) : null}
    </div>
  );
}
