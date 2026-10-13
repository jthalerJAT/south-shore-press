import React from 'react';

/**
 * Inline body formatting (publisher direction 2026-10-19): story bodies stay
 * PLAIN TEXT in the database, with four lightweight markers editors insert
 * from the body toolbar (or Ctrl+B / Ctrl+U / Ctrl+I):
 *
 *   **bold**   __underline__   *italic*   [size=20]bigger text[/size]
 *
 * This module is the single source of truth for those markers. It renders them
 * on the website (InlineText), in the print engine (appendInlineTo for the
 * measurer + renderInlineSegments for the band renderer), and strips them
 * where only plain text belongs (meta descriptions).
 *
 * Markers TOGGLE state and the scanner carries state across paragraphs and
 * arbitrary chunk boundaries — the print engine slices text mid-paragraph at
 * column breaks, so each slice is scanned starting from the state left by the
 * text before it (see layoutBand). Sizes are px on the 16px website body and
 * scale with the medium everywhere by rendering as `em` (size/16), so
 * [size=20] is 20px on the site and proportionally larger in print's 14px
 * body.
 *
 * No 'use client' here: server components (the story page) import InlineText,
 * and only browser code calls the DOM helper.
 */

export type InlineState = {
  b: boolean;
  u: boolean;
  i: boolean;
  /** Stack of open [size=N] values; the innermost wins. */
  sizes: number[];
};

export function initialInlineState(): InlineState {
  return { b: false, u: false, i: false, sizes: [] };
}

export type InlineSegment = {
  text: string;
  b: boolean;
  u: boolean;
  i: boolean;
  /** px on the 16px web body; null = normal size. */
  size: number | null;
};

const SIZE_OPEN = /^\[size=(\d{1,2})\]/;
const SIZE_CLOSE = '[/size]';
export const MIN_INLINE_SIZE = 10;
export const MAX_INLINE_SIZE = 40;

/** Scan `text`, consuming markers; returns the styled segments and the state
 *  left for whatever text follows. Mutates a COPY of the given state. */
export function scanInline(
  text: string,
  state: InlineState = initialInlineState()
): { segments: InlineSegment[]; state: InlineState } {
  const s: InlineState = { ...state, sizes: [...state.sizes] };
  const segments: InlineSegment[] = [];
  let buf = '';

  const flush = () => {
    if (!buf) return;
    segments.push({
      text: buf,
      b: s.b,
      u: s.u,
      i: s.i,
      size: s.sizes.length > 0 ? s.sizes[s.sizes.length - 1] : null,
    });
    buf = '';
  };

  let idx = 0;
  while (idx < text.length) {
    const ch = text[idx];
    if (ch === '*' && text[idx + 1] === '*') {
      flush();
      s.b = !s.b;
      idx += 2;
      continue;
    }
    if (ch === '_' && text[idx + 1] === '_') {
      flush();
      s.u = !s.u;
      idx += 2;
      continue;
    }
    if (ch === '*') {
      flush();
      s.i = !s.i;
      idx += 1;
      continue;
    }
    if (ch === '[') {
      const m = SIZE_OPEN.exec(text.slice(idx));
      if (m) {
        const n = Math.min(MAX_INLINE_SIZE, Math.max(MIN_INLINE_SIZE, parseInt(m[1], 10)));
        flush();
        s.sizes.push(n);
        idx += m[0].length;
        continue;
      }
      if (text.startsWith(SIZE_CLOSE, idx)) {
        flush();
        s.sizes.pop();
        idx += SIZE_CLOSE.length;
        continue;
      }
    }
    buf += ch;
    idx += 1;
  }
  flush();
  return { segments, state: s };
}

/** The formatting state after `text` (markers consumed, output discarded). */
export function stateAfter(text: string, state: InlineState = initialInlineState()): InlineState {
  return scanInline(text, state).state;
}

/** True when every visible part of the paragraph is bold — the voter-guide
 *  "section head" pattern. Such paragraphs render left-aligned (no justify
 *  stretch), unindented, with extra space above, on the site and in print. */
export function isAllBoldParagraph(
  text: string,
  state: InlineState = initialInlineState()
): boolean {
  const { segments } = scanInline(text, state);
  const visible = segments.filter((s) => s.text.trim() !== '');
  return visible.length > 0 && visible.every((s) => s.b);
}

/** True when the text carries any marker — cheap gate before full scans. */
export function hasInlineMarkers(text: string): boolean {
  return /\*|__|\[size=/.test(text);
}

/** Markers removed — for meta descriptions, excerpts, and other plain-text
 *  contexts where **stars** would leak. */
export function stripInlineMarkers(text: string): string {
  return text
    .replace(/\[size=\d{1,2}\]/g, '')
    .replace(/\[\/size\]/g, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/\*/g, '');
}

function segmentStyle(seg: InlineSegment): React.CSSProperties | undefined {
  if (!seg.b && !seg.u && !seg.i && seg.size === null) return undefined;
  const style: React.CSSProperties = {};
  if (seg.b) style.fontWeight = 700;
  if (seg.u) style.textDecoration = 'underline';
  if (seg.i) style.fontStyle = 'italic';
  if (seg.size !== null) style.fontSize = `${seg.size / 16}em`;
  return style;
}

/** React renderer. `state` lets the print engine continue formatting that a
 *  column break split; plain callers omit it. */
export function InlineText({
  text,
  state,
}: {
  text: string;
  state?: InlineState;
}): React.ReactElement {
  if (!hasInlineMarkers(text) && (!state || (!state.b && !state.u && !state.i && state.sizes.length === 0))) {
    return <>{text}</>;
  }
  const { segments } = scanInline(text, state);
  return (
    <>
      {segments.map((seg, i) => {
        const style = segmentStyle(seg);
        return style ? (
          <span key={i} style={style}>
            {seg.text}
          </span>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        );
      })}
    </>
  );
}

/** DOM version for the print measurer: appends styled spans for `text` to
 *  `el` and returns the carried-over state. The spans' CSS must match
 *  InlineText exactly or measured heights drift from rendered ones. */
export function appendInlineTo(
  el: HTMLElement,
  text: string,
  state: InlineState = initialInlineState()
): InlineState {
  const { segments, state: next } = scanInline(text, state);
  for (const seg of segments) {
    if (!seg.b && !seg.u && !seg.i && seg.size === null) {
      el.appendChild(document.createTextNode(seg.text));
      continue;
    }
    const span = document.createElement('span');
    if (seg.b) span.style.fontWeight = '700';
    if (seg.u) span.style.textDecoration = 'underline';
    if (seg.i) span.style.fontStyle = 'italic';
    if (seg.size !== null) span.style.fontSize = `${seg.size / 16}em`;
    span.textContent = seg.text;
    el.appendChild(span);
  }
  return next;
}
