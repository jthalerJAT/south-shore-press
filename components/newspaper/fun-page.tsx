'use client';

/**
 * FunPage — renders a "Fun Stuff" page (Box Office / Puzzles / Funny Pages /
 * History). Layout at 11×15:
 *   - our "Fun Stuff" section header on top,
 *   - the page pulled from the source app in the TOP TWO-THIRDS (isolated in a
 *     srcdoc iframe so the app CSS can't leak; the app's own reserved ad box is
 *     hidden so we control the ad),
 *   - an ad slot in the BOTTOM THIRD, filled from the Ad Database.
 * Used by the editor preview, the per-page proof, View File, and the press print
 * route — so screen == print.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { adFilePublicUrl } from '@/lib/ad-files';
import { SectionFlag } from './section-flag';
import { FUN_SECTION_HEADER, type FunPageData } from '@/lib/newspaper/fun-page';

/** Native width of every Fun Stuff app's `#newspaperPage` node. */
const APP_PAGE_W = 780;
/** Fallback aspect (h/w) before the real content height is measured. */
const FALLBACK_RATIO = 1.2;

export function FunPage({
  data,
  sectionLabel = FUN_SECTION_HEADER,
  editing = false,
}: {
  data: FunPageData;
  /** Section header; defaults to the shared "Fun Stuff" masthead. */
  sectionLabel?: string;
  /** When true (editor/proof preview) show placeholders for empty regions. */
  editing?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [contentH, setContentH] = useState(APP_PAGE_W * FALLBACK_RATIO);

  const html = data.html ?? '';
  const css = data.css ?? '';
  // App CSS first, then our overrides last so they reliably win: hide the app's
  // own reserved ad box (we place our own ad in the bottom third).
  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">` +
      `<style>html,body{margin:0;padding:0;background:#fff}</style>` +
      `<style>${css}</style>` +
      `<style>.ad-section,.ad-slot,.advertisement{display:none!important}</style>` +
      `</head><body>${html}</body></html>`
    : '';

  const adSrc = data.ad_storage_path ? adFilePublicUrl(data.ad_storage_path) : null;

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
        /* srcdoc is same-origin, but stay defensive */
      }
      const availW = area2.clientWidth || CONTENT_W_PX;
      const availH = area2.clientHeight || CONTENT_H_PX;
      const s = Math.min(availW / APP_PAGE_W, availH / h);
      setContentH(h);
      setScale(s > 0 ? s : availW / APP_PAGE_W);
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

      {/* Body below the header: top two-thirds content + bottom-third ad. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Top two-thirds — the pulled page. */}
        <div ref={areaRef} style={{ flex: 2, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
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

        {/* Bottom third — ad from the Ad Database. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            borderTop: '1px solid #d4d4d8',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {adSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={adSrc}
              alt={data.ad_file_name ?? 'Advertisement'}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : editing ? (
            <div
              className="m-3 border-2 border-dashed border-zinc-300 text-zinc-400 text-xs uppercase tracking-widest flex items-center justify-center text-center"
              style={{ width: '100%', height: '100%' }}
            >
              Advertisement — add one from the Ad Database
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
