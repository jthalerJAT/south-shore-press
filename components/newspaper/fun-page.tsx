'use client';

/**
 * FunPage — renders a "Fun Stuff" page (Box Office / Puzzles / Funny Pages /
 * History): our section header on top, then the self-contained page pulled from
 * the source app scaled to fit the rest of the 11×15 content area. The pulled
 * markup is rendered inside a same-origin srcdoc iframe so the app's CSS is fully
 * isolated (can't leak into the portal/print styles). Used by the editor preview,
 * the per-page proof, View File, and the press print route — so screen == print.
 *
 * The apps render `#newspaperPage` at a fixed 780px width; we measure the pulled
 * content height on load and pick a uniform "contain" scale so the whole page
 * shows without cropping or distortion.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { SectionFlag } from './section-flag';
import type { FunPageData } from '@/lib/newspaper/fun-page';

/** Native width of every Fun Stuff app's `#newspaperPage` node. */
const APP_PAGE_W = 780;
/** Fallback aspect (h/w) before the real content height is measured. */
const FALLBACK_RATIO = 1.47;

export function FunPage({
  data,
  sectionLabel,
  editing = false,
}: {
  data: FunPageData;
  sectionLabel: string;
  /** When true (editor/proof preview) show a placeholder if nothing is pulled. */
  editing?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [contentH, setContentH] = useState(APP_PAGE_W * FALLBACK_RATIO);

  const html = data.html ?? '';
  const css = data.css ?? '';
  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8">` +
      `<base target="_blank"><style>html,body{margin:0;padding:0;background:#fff}</style>` +
      `<style>${css}</style></head><body>${html}</body></html>`
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
        /* srcdoc is same-origin, but stay defensive */
      }
      const availW = area2.clientWidth || CONTENT_W_PX;
      const availH = area2.clientHeight || CONTENT_H_PX;
      const s = Math.min(availW / APP_PAGE_W, availH / h);
      setContentH(h);
      setScale(s > 0 ? s : availW / APP_PAGE_W);
    }

    frame.addEventListener('load', fit);
    // Also try after a beat in case load already fired / content settles late.
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
      <div ref={areaRef} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
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
            Nothing pulled yet — click “Pull from {sectionLabel}” to generate this page.
          </div>
        ) : null}
      </div>
    </div>
  );
}
