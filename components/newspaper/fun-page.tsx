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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { imagePublicUrl } from '@/lib/newspaper-images';
import { adFilePublicUrl } from '@/lib/ad-files';
import { AdCopyView } from './ad-copy';
import { PageHeader } from './page-header';
import { SectionFlag } from './section-flag';
import { FUN_SECTION_HEADER, funBlockIsFull, type FunPageData, type FunBlock } from '@/lib/newspaper/fun-page';

/** Native width of every Fun Stuff app's `#newspaperPage` node (fallback only —
 *  the fit routine measures + reflows the real node). */
const APP_PAGE_W = 780;
const FALLBACK_RATIO = 1.2;
/** Bounds for the reflow width search. */
const REFLOW_MIN_W = 600;
const REFLOW_MAX_W = 2200;
/** Block band heights (approx page fractions). */
const BAND_FULL_H = Math.round(CONTENT_H_PX * 0.3); // ~1/3 page
const BAND_HALF_H = Math.round(CONTENT_H_PX * 0.24); // ~1/4 page

/** Selectors the source apps use for parts we re-arrange: their reserved ad box
 *  (we place our own ads in the bottom band) and the puzzle answer key (moved
 *  BELOW our ad band so answers never sit next to the puzzles). */
const APP_AD_SELECTORS = '.ad-section,.ad-slot,.advertisement';
const APP_ANSWERS_SELECTORS = '.answers-section,#answersSection';

export function FunPage({
  data,
  sectionLabel = FUN_SECTION_HEADER,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: FunPageData;
  sectionLabel?: string;
  /** Running-head page number; omitted → no header (back-compat). */
  pageNumber?: number;
  /** Issue date from the Front Page, shown in the running head. */
  dateLabel?: string;
  editing?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [frameW, setFrameW] = useState(APP_PAGE_W);
  const [contentH, setContentH] = useState(APP_PAGE_W * FALLBACK_RATIO);
  // Saved pages hold the pulled snapshot in Storage (it's far too large for a
  // row); fetch it when no inline html was provided.
  const [fetchedSnap, setFetchedSnap] = useState<{ html: string; css: string } | null>(null);

  useEffect(() => {
    if (data.html || !data.snapshot_path) return;
    let alive = true;
    fetch(imagePublicUrl(data.snapshot_path))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && typeof j.html === 'string') {
          setFetchedSnap({ html: j.html, css: typeof j.css === 'string' ? j.css : '' });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [data.html, data.snapshot_path]);

  const html = data.html ?? fetchedSnap?.html ?? '';
  const css = data.css ?? fetchedSnap?.css ?? '';
  const blocks = data.blocks ?? [];

  // The answer key (puzzles) prints below our ad band, so it is cut out of the
  // pulled content and rendered as its own strip. DOM parsing is client-only.
  const [answersHtml, setAnswersHtml] = useState<string | null>(null);
  useEffect(() => {
    if (!html) {
      setAnswersHtml(null);
      return;
    }
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const el = doc.querySelector(APP_ANSWERS_SELECTORS);
      setAnswersHtml(el ? el.outerHTML : null);
    } catch {
      setAnswersHtml(null);
    }
  }, [html]);

  // App CSS first, then our overrides last so they reliably win: hide the app's
  // own reserved ad box + answer key (both re-placed by us), and collapse any
  // fixed "paper page" height the app bakes in (e.g. min-height:1147px) — with
  // sections hidden that height is empty whitespace the fitter would otherwise
  // scale in, cramming the real content at the top of the area.
  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">` +
      `<style>html,body{margin:0;padding:0;background:#fff}</style>` +
      `<style>${css}</style>` +
      `<style>${APP_AD_SELECTORS},${APP_ANSWERS_SELECTORS}{display:none!important}` +
      `#newspaperPage{height:auto!important;min-height:0!important}</style>` +
      `</head><body>${html}</body></html>`
    : '';

  // Answer key strip (below the ad band): rendered at the app's native width in
  // its own iframe, scaled to our content width; height measured from the doc.
  const answersFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [answersH, setAnswersH] = useState(0);
  const answersScale = CONTENT_W_PX / APP_PAGE_W;
  const answersSrcDoc = answersHtml
    ? `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>${css}</style>` +
      // Overrides after the app CSS so they win — the strip lives outside the
      // app's white "paper page" wrapper, so its dark page backdrop would
      // otherwise show through behind the answers.
      `<style>html,body{margin:0!important;padding:0!important;background:#fff!important}` +
      `${APP_ANSWERS_SELECTORS}{display:block!important;padding-left:0!important;padding-right:0!important}</style>` +
      `</head><body>${answersHtml}</body></html>`
    : '';

  useEffect(() => {
    if (!answersSrcDoc) {
      setAnswersH(0);
      return;
    }
    const frame = answersFrameRef.current;
    if (!frame) return;
    function measure() {
      try {
        const h = answersFrameRef.current?.contentDocument?.body?.scrollHeight ?? 0;
        if (h > 0) setAnswersH(h);
      } catch {
        /* same-origin srcdoc; stay defensive */
      }
    }
    frame.addEventListener('load', measure);
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 800);
    return () => {
      frame.removeEventListener('load', measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [answersSrcDoc]);

  // How much of the page height the bottom band + answers strip take changes
  // the area the pulled content must fill — refit when either changes.
  const bandKey = blocks.map((b) => (funBlockIsFull(b) ? 'f' : 'h')).join('') + `|a${answersH}`;

  useLayoutEffect(() => {
    if (!html) return;
    const frame = frameRef.current;
    const area = areaRef.current;
    if (!frame || !area) return;
    function fit() {
      const area2 = areaRef.current;
      const frame2 = frameRef.current;
      if (!area2 || !frame2) return;
      const availW = area2.clientWidth || CONTENT_W_PX;
      const availH = area2.clientHeight || CONTENT_H_PX;
      let w = APP_PAGE_W;
      let h = APP_PAGE_W * FALLBACK_RATIO;
      try {
        const doc = frame2.contentDocument;
        const node = doc?.getElementById('newspaperPage') ?? doc?.body ?? null;
        if (node && node.scrollHeight > 0) {
          // The pulled page has a fixed design width but arbitrary height, so
          // neither fit-to-width (clips the bottom) nor fit-to-contain
          // (letterboxes the sides) matches the paper. Instead REFLOW: widen or
          // narrow the page node until its natural height/width ratio matches
          // the area's, then scale that reflowed page to fill it exactly.
          const el = node as HTMLElement;
          const targetRatio = availH / availW;
          const measure = (width: number) => {
            el.style.width = `${width}px`;
            void el.getBoundingClientRect(); // force layout
            return el.scrollHeight;
          };
          // h(w) is non-increasing in w, so h(w)/w strictly decreases: bisect.
          let lo = REFLOW_MIN_W;
          let hi = REFLOW_MAX_W;
          if (measure(lo) / lo <= targetRatio) {
            hi = lo; // already shorter than the area at the narrowest width
          } else if (measure(hi) / hi >= targetRatio) {
            lo = hi; // taller than the area even at the widest width
          } else {
            for (let i = 0; i < 8; i++) {
              const mid = Math.round((lo + hi) / 2);
              if (measure(mid) / mid > targetRatio) lo = mid;
              else hi = mid;
            }
          }
          w = hi;
          h = measure(w);
        }
      } catch {
        /* srcdoc is same-origin; stay defensive */
      }
      setFrameW(w);
      setContentH(h);
      // Fill the width; the reflow made the height come out at (or just under)
      // the area height, so nothing is clipped and nothing is letterboxed.
      setScale(Math.min(availW / w, availH / h));
    }
    frame.addEventListener('load', fit);
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 800);
    return () => {
      frame.removeEventListener('load', fit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [html, css, bandKey]);

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
      {/* Running head first, like every interior page; the reflow fitter
          measures whatever area remains, so pulled content adapts unharmed. */}
      {typeof pageNumber === 'number' && pageNumber > 0 ? (
        <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />
      ) : null}
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
              width: frameW,
              height: contentH,
              visibility: scale === null ? 'hidden' : 'visible',
            }}
          >
            <iframe
              ref={frameRef}
              srcDoc={srcDoc}
              title={sectionLabel}
              scrolling="no"
              style={{ width: frameW, height: contentH, border: 0, display: 'block' }}
            />
          </div>
        ) : editing ? (
          <div
            className="border-2 border-dashed border-zinc-300 text-zinc-400 text-sm flex items-center justify-center text-center px-6"
            style={{ width: '100%', height: '100%' }}
          >
            {data.snapshot_path
              ? 'Loading the saved page…'
              : 'Nothing pulled yet — click “Pull from …” to generate this page.'}
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

      {/* Answer key — always the last thing on the page, below the ad band. */}
      {answersSrcDoc ? (
        <div
          style={{
            flexShrink: 0,
            height: Math.ceil(answersH * answersScale),
            overflow: 'hidden',
            borderTop: '1px solid #d4d4d8',
            marginTop: 4,
          }}
        >
          <div style={{ transform: `scale(${answersScale})`, transformOrigin: 'top left', width: APP_PAGE_W }}>
            <iframe
              ref={answersFrameRef}
              srcDoc={answersSrcDoc}
              title="Puzzle answers"
              scrolling="no"
              style={{ width: APP_PAGE_W, height: Math.max(answersH, 10), border: 0, display: 'block' }}
            />
          </div>
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
          <AdCopyView
            src={src}
            fileName={block.ad_file_name}
            storagePath={block.ad_storage_path}
            style={{ width: '100%', height: full ? BAND_FULL_H : BAND_HALF_H, objectFit: 'contain' }}
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
