'use client';

/**
 * Client-side text Measurer for the layout engine. Renders candidate
 * paragraphs into a single hidden offscreen host at print scale and reads back
 * the laid-out height. The host's type metrics MUST match both the engine
 * constants and the BandRenderer's column CSS, or measured heights won't match
 * what the user sees.
 */
import {
  BODY_FONT_FAMILY,
  BODY_FONT_SIZE_PX,
  BODY_LINE_HEIGHT_PX,
  PARA_SPACING_PX,
  type Measurer,
} from './layout-engine';

let host: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (host && host.isConnected) return host;
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'left:-99999px',
    'top:0',
    'pointer-events:none',
    'box-sizing:border-box',
    'white-space:normal',
    'word-break:normal',
    'overflow-wrap:normal',
    'hyphens:none',
    `font-family:${BODY_FONT_FAMILY}`,
    `font-size:${BODY_FONT_SIZE_PX}px`,
    `line-height:${BODY_LINE_HEIGHT_PX}px`,
  ].join(';');
  document.body.appendChild(d);
  host = d;
  return d;
}

/** A DOM-backed Measurer. Safe to create many; they share one host. */
export function createMeasurer(): Measurer {
  return {
    measureParas(paras: string[], widthPx: number): number {
      if (paras.length === 0) return 0;
      const h = ensureHost();
      h.style.width = `${Math.max(1, Math.floor(widthPx))}px`;
      h.textContent = '';
      paras.forEach((text, i) => {
        const p = document.createElement('p');
        p.textContent = text;
        p.style.margin = '0';
        if (i > 0) p.style.marginTop = `${PARA_SPACING_PX}px`;
        h.appendChild(p);
      });
      return h.getBoundingClientRect().height;
    },
  };
}

/** Resolve once web fonts have loaded so the first measure isn't stale. */
export async function whenFontsReady(): Promise<void> {
  try {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    }
  } catch {
    /* fonts API unavailable — proceed with system-font metrics */
  }
}
