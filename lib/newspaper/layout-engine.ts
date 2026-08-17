/**
 * Newspaper layout engine — PURE geometry + text-flow logic for the visual
 * "Edit Page Layout" tool (Phase 2A). No DOM access: height measurement is
 * delegated to an injected `Measurer`, so this module is unit-testable and is
 * the single source of truth shared by the editor canvas, the print proof,
 * and (later) the Phase 2B overflow/continuation pass.
 *
 * Coordinate model
 * ----------------
 *  - Horizontal: a band is an N-track column grid spanning the page content
 *    width. Columns are equal width with a fixed gutter.
 *  - Vertical: everything is stored as a FRACTION of the page CONTENT height
 *    (so it's resolution-independent — the canvas and the proof reproduce the
 *    same layout at any pixel scale) and resolved to print-px (96 dpi) here.
 *
 * The page is an 11in × 15in tabloid; we lay out + measure at print scale and
 * the editor only CSS-scales for zoom, so measurement is zoom-independent.
 */

// ── Page constants (print scale, 96 dpi) ──────────────────────────────────
export const DPI = 96;
export const PAGE_W_IN = 11;
export const PAGE_H_IN = 15;
export const MARGIN_IN = 0.5;

export const PAGE_W_PX = Math.round(PAGE_W_IN * DPI); // 1056
export const PAGE_H_PX = Math.round(PAGE_H_IN * DPI); // 1440
export const CONTENT_W_PX = Math.round((PAGE_W_IN - 2 * MARGIN_IN) * DPI); // 960
export const CONTENT_H_PX = Math.round((PAGE_H_IN - 2 * MARGIN_IN) * DPI); // 1344

export const COLUMN_GAP_PX = 14;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 5;
export const DEFAULT_COLUMNS = 4;

/**
 * Body type metrics. These MUST match the CSS the BandRenderer applies to the
 * column text + the hidden Measurer, or measured heights won't match render.
 */
// Crimson Text matches the printed paper's editorial serif (loaded via
// next/font in app/layout.tsx as --font-crimson). Falls back to Georgia.
export const BODY_FONT_FAMILY = "var(--font-crimson), Georgia, 'Times New Roman', serif";
// Matched to the printed paper (measured from the 2026-06-24 issue, page 2):
// body is Crimson Text 10.5pt with ~11pt leading — a tight ~1.05× pitch. At
// 96dpi that's 14px / 15px. This density is what lets a full page of text +
// photos + ad fit one sheet; bigger type/looser leading overflows.
export const BODY_FONT_SIZE_PX = 14;
export const BODY_LINE_HEIGHT_PX = 15;
export const PARA_SPACING_PX = 2;

/** Default embedded-photo height, as a fraction of page content height. */
export const DEFAULT_PHOTO_HEIGHT_FRAC = 0.18;
/** A run shorter than this (px) can't hold even one line — skip it. */
const MIN_RUN_PX = BODY_LINE_HEIGHT_PX;

// ── Stored layout shapes (what lands in np_items.layout jsonb) ─────────────
export type StoredPhotoLayout = {
  /** 'column' snaps to the column grid (default); 'free' uses x/width. */
  mode: 'column' | 'free';
  /** 1-based first column the photo occupies (column mode). */
  col_start: number;
  /** Number of columns the photo spans (column mode). */
  col_span: number;
  /** Vertical offset of the photo top from the band top, as a fraction of
   *  page content height. 0 = top-aligned. */
  top: number;
  /** Photo height as a fraction of page content height. */
  height: number;
  /** Free mode only: left + width as fractions of page content WIDTH. */
  x?: number;
  width?: number;
};

export type StoredStoryLayout = {
  v: 1;
  kind: 'story';
  band_index: number;
  /** 2–5; default 4. */
  column_count: number;
  /** Explicit band height as a fraction of content height, or null = auto. */
  band_height: number | null;
  photo: StoredPhotoLayout | null;
};

export type AdSizeValue = 'full' | 'half' | 'third' | 'quarter';

export type StoredAdLayout = {
  v: 1;
  kind: 'ad';
  band_index: number;
  size: AdSizeValue;
  /** Ad block height as a fraction of content height. */
  height: number;
};

export type StoredLayout = StoredStoryLayout | StoredAdLayout;

/** Ad heights as a fraction of page content height (the text area, excluding
 *  the running head) — a full-page band fills it, the others are proportionate
 *  fractions of that. Quarter and third ads DO NOT use this anymore: they have
 *  FIXED pixel sizes (below) per publisher direction. */
export const AD_HEIGHT_FRAC: Record<AdSizeValue, number> = {
  full: 0.92,
  half: 0.46,
  third: 0.307,
  quarter: 0.23,
};

// ── Fixed ad sizes (publisher direction 2026-08-10) ─────────────────────────
// Quarter- and third-page ads are ALWAYS exactly the same size — they never
// fluctuate with the page's spacing/photo/columns fit levers. Sized off the
// PRINTABLE area (content box minus the running head and the section flag),
// slightly smaller than the exact 1/4 and 1/3 fractions, matching the printed
// precedent (e.g. 356×504pt quarter ads on the 720×1008pt content of the
// 2026-06-17 / 2026-02-25 issues).
/** Running PageHeader height (text row + divider + margin) at print scale. */
export const RUNNING_HEAD_H_PX = 36;
/** SectionFlag height (navy parallelogram + margin) at print scale. */
export const SECTION_FLAG_H_PX = 44;
/** The printable story area of an interior page. */
export const PRINTABLE_H_PX = CONTENT_H_PX - RUNNING_HEAD_H_PX - SECTION_FLAG_H_PX;
/** Quarter-page ad: a hair under half the width × half the printable height. */
export const QUARTER_AD_W_PX = Math.round(CONTENT_W_PX * 0.5 * 0.95); // 456
export const QUARTER_AD_H_PX = Math.round((PRINTABLE_H_PX / 2) * 0.95); // ~600
/** Third-page ad: a full-width strip a hair under a third of the printable
 *  height, pinned to the page bottom. */
export const THIRD_AD_H_PX = Math.round((PRINTABLE_H_PX / 3) * 0.95); // ~400

/** Bottom-anchored corner-ad exclusion inside a story band: the creative
 *  renders at an EXACT fixed pixel rect (leftPx/widthPx/heightPx — never
 *  fluctuates), pinned to the band's bottom edge so it lands in the page
 *  corner. colStart0/colSpan are the columns the rect overlaps — the text
 *  runs exclude whole columns, so a sliver of white may sit between the ad
 *  edge and the next column, exactly like the printed paper. */
export type CornerAd = {
  leftPx: number;
  widthPx: number;
  heightPx: number;
  colStart0: number;
  colSpan: number;
};

// ── Defaults + normalisation (raw jsonb → fully-populated typed layout) ────
export function defaultStoryLayout(
  bandIndex: number,
  hasPhoto: boolean
): StoredStoryLayout {
  return {
    v: 1,
    kind: 'story',
    band_index: bandIndex,
    column_count: DEFAULT_COLUMNS,
    band_height: null,
    photo: hasPhoto
      ? {
          mode: 'column',
          col_start: 2,
          col_span: 2,
          top: 0,
          height: DEFAULT_PHOTO_HEIGHT_FRAC,
        }
      : null,
  };
}

export function defaultAdLayout(
  bandIndex: number,
  size: StoredAdLayout['size']
): StoredAdLayout {
  return { v: 1, kind: 'ad', band_index: bandIndex, size, height: AD_HEIGHT_FRAC[size] };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Normalise a raw photo blob against a column count, clamping into range. */
function normalizePhoto(
  raw: unknown,
  columns: number
): StoredPhotoLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const mode = r.mode === 'free' ? 'free' : 'column';
  const col_span = clamp(Math.round(num(r.col_span, 2)), 1, columns);
  const col_start = clamp(Math.round(num(r.col_start, 2)), 1, columns - col_span + 1);
  const photo: StoredPhotoLayout = {
    mode,
    col_start,
    col_span,
    top: clamp(num(r.top, 0), 0, 1),
    height: clamp(num(r.height, DEFAULT_PHOTO_HEIGHT_FRAC), 0.02, 1),
  };
  if (mode === 'free') {
    photo.x = clamp(num(r.x, 0), 0, 1);
    photo.width = clamp(num(r.width, 0.5), 0.05, 1);
  }
  return photo;
}

export function normalizeStoryLayout(
  raw: unknown,
  bandIndex: number,
  hasPhoto: boolean
): StoredStoryLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const column_count = clamp(Math.round(num(r.column_count, DEFAULT_COLUMNS)), MIN_COLUMNS, MAX_COLUMNS);
  const rawPhoto = 'photo' in r ? r.photo : hasPhoto ? {} : null;
  return {
    v: 1,
    kind: 'story',
    band_index: typeof r.band_index === 'number' ? r.band_index : bandIndex,
    column_count,
    band_height:
      typeof r.band_height === 'number' && Number.isFinite(r.band_height)
        ? clamp(r.band_height, 0, 1)
        : null,
    photo: normalizePhoto(rawPhoto, column_count),
  };
}

export function normalizeAdLayout(
  raw: unknown,
  bandIndex: number,
  size: StoredAdLayout['size']
): StoredAdLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const sz = (r.size === 'full' || r.size === 'half' || r.size === 'third' || r.size === 'quarter'
    ? r.size
    : size) as StoredAdLayout['size'];
  return {
    v: 1,
    kind: 'ad',
    band_index: typeof r.band_index === 'number' ? r.band_index : bandIndex,
    size: sz,
    height: clamp(num(r.height, AD_HEIGHT_FRAC[sz]), 0.02, 1),
  };
}

// ── Px geometry ────────────────────────────────────────────────────────────
export type ColumnRect = { x: number; w: number };
export type PhotoRectPx = { left: number; top: number; width: number; height: number; colStart0: number; colSpan: number };
export type ColumnRun = {
  colIdx: number;
  topPx: number;
  heightPx: number;
  /** Runaround override: when a corner ad only PARTLY covers this column, the
   *  segment beside the ad narrows to the ad edge (minus the gutter) instead
   *  of the whole column being dropped. Absent → the column's normal x/w. */
  xPx?: number;
  wPx?: number;
};
export type RunSlice = ColumnRun & {
  x: number;
  w: number;
  text: string;
  /** True if this run begins at a paragraph boundary (so its first line should
   *  be indented). False when it continues a paragraph from the previous column
   *  — those continuations must NOT be indented. */
  startsParagraph: boolean;
};

export type BandGeometry = {
  /** Band width in px (full-width bands == CONTENT_W_PX). */
  contentWidthPx: number;
  /** Available body height (px) for column text flow. */
  bodyHeightPx: number;
  columns: number;
  gapPx: number;
  photo: PhotoRectPx | null;
  /** Bottom-corner quarter-page ad the text wraps around (see CornerAd). */
  cornerAd?: CornerAd | null;
};

export type LayoutResult = {
  runs: RunSlice[];
  fits: boolean;
  overflow: null | { paragraphIndex: number; wordIndex: number; remainderText: string };
  consumedChars: number;
};

export function columnWidthPx(contentWidthPx: number, columns: number, gapPx = COLUMN_GAP_PX): number {
  return (contentWidthPx - (columns - 1) * gapPx) / columns;
}

export function columnRects(contentWidthPx: number, columns: number, gapPx = COLUMN_GAP_PX): ColumnRect[] {
  const w = columnWidthPx(contentWidthPx, columns, gapPx);
  return Array.from({ length: columns }, (_, c) => ({ x: c * (w + gapPx), w }));
}

/** Resolve a stored photo (fractions) into px within the band. */
export function photoRectPx(
  photo: StoredPhotoLayout,
  contentWidthPx: number,
  columns: number,
  gapPx = COLUMN_GAP_PX
): PhotoRectPx {
  const heightPx = photo.height * CONTENT_H_PX;
  const topPx = photo.top * CONTENT_H_PX;
  if (photo.mode === 'free') {
    const left = (photo.x ?? 0) * contentWidthPx;
    const width = (photo.width ?? 0.5) * contentWidthPx;
    // Map a free rect back onto whole columns for text exclusion.
    const rects = columnRects(contentWidthPx, columns, gapPx);
    const colStart0 = Math.max(0, rects.findIndex((r) => r.x + r.w > left + 1));
    let colEnd0 = colStart0;
    while (colEnd0 < columns - 1 && rects[colEnd0].x + rects[colEnd0].w < left + width - 1) colEnd0++;
    return { left, top: topPx, width, height: heightPx, colStart0, colSpan: colEnd0 - colStart0 + 1 };
  }
  const rects = columnRects(contentWidthPx, columns, gapPx);
  const colStart0 = clampInt(photo.col_start - 1, 0, columns - 1);
  const colSpan = clampInt(photo.col_span, 1, columns - colStart0);
  const left = rects[colStart0].x;
  const last = rects[colStart0 + colSpan - 1];
  const width = last.x + last.w - left;
  return { left, top: topPx, width, height: heightPx, colStart0, colSpan };
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/**
 * The ordered list of text "runs" — per column, the vertical segments left
 * over after subtracting every exclusion that overlaps that column (the photo
 * rect, and the bottom-corner ad when present). Flow order is col0 then col1
 * etc., top segment before bottom, which yields: full text in unshadowed
 * columns, and text wrapping the exclusions' open sides in shadowed ones.
 */
export function computeRuns(geo: BandGeometry): ColumnRun[] {
  const runs: ColumnRun[] = [];
  const { photo, columns, bodyHeightPx, gapPx } = geo;
  const ad = geo.cornerAd ?? null;
  const rects = columnRects(geo.contentWidthPx, columns, gapPx);
  const adTop = ad ? bodyHeightPx - ad.heightPx : 0;
  for (let c = 0; c < columns; c++) {
    const blocked: Array<[number, number]> = [];
    if (photo && c >= photo.colStart0 && c < photo.colStart0 + photo.colSpan) {
      blocked.push([photo.top, photo.top + photo.height]);
    }
    // Corner ad: a column the ad only PARTLY covers keeps a narrowed run
    // beside the ad (text runs up to the ad edge minus the gutter); a column
    // the ad substantially covers is blocked for the ad's height.
    let runaround: { xPx: number; wPx: number } | null = null;
    if (ad && c >= ad.colStart0 && c < ad.colStart0 + ad.colSpan) {
      runaround = cornerAdRunaround(rects[c], ad, gapPx);
      if (!runaround) blocked.push([adTop, bodyHeightPx]);
    }
    blocked.sort((a, b) => a[0] - b[0]);

    // Emit the column's open segments; any segment (or part of one) that lies
    // beside the ad takes the runaround width.
    const emit = (top: number, bottom: number) => {
      if (bottom - top < MIN_RUN_PX) return;
      if (runaround && bottom > adTop) {
        if (top < adTop) {
          if (adTop - top >= MIN_RUN_PX) runs.push({ colIdx: c, topPx: top, heightPx: adTop - top });
          top = adTop;
        }
        if (bottom - top >= MIN_RUN_PX) {
          runs.push({ colIdx: c, topPx: top, heightPx: bottom - top, ...runaround });
        }
        return;
      }
      runs.push({ colIdx: c, topPx: top, heightPx: bottom - top });
    };

    let cursor = 0;
    for (const [top, bottom] of blocked) {
      emit(cursor, top);
      cursor = Math.max(cursor, bottom);
    }
    emit(cursor, bodyHeightPx);
  }
  return runs;
}

/** Narrowest runaround column we'll set beside a corner ad (px). Below this
 *  the column is dropped for the ad's height instead — a sliver of a few
 *  characters per line reads worse than white space. */
export const MIN_RUNAROUND_W_PX = 60;

/** The open strip of column `rect` beside the corner ad, or null if the ad
 *  covers (nearly) all of it. Text keeps one gutter's clearance from the ad. */
function cornerAdRunaround(
  rect: ColumnRect,
  ad: CornerAd,
  gapPx: number
): { xPx: number; wPx: number } | null {
  const adLeft = ad.leftPx;
  const adRight = ad.leftPx + ad.widthPx;
  const colRight = rect.x + rect.w;
  const anchoredLeft = adLeft <= 1;
  const openLeft = anchoredLeft ? Math.max(rect.x, adRight + gapPx) : rect.x;
  const openRight = anchoredLeft ? colRight : Math.min(colRight, adLeft - gapPx);
  const w = openRight - openLeft;
  if (w < MIN_RUNAROUND_W_PX) return null;
  return { xPx: openLeft, wPx: w };
}

// ── Text flow ───────────────────────────────────────────────────────────────
export type Paragraph = string[]; // words
export type ParsedBody = { paragraphs: Paragraph[]; words: Array<{ p: number; w: string }> };

/** Split a plain-text body into paragraphs (blank-line separated) → words. */
export function parseBody(body: string | undefined): ParsedBody {
  const paragraphs = String(body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split(/\s+/).filter(Boolean));
  const words: Array<{ p: number; w: string }> = [];
  paragraphs.forEach((para, p) => para.forEach((w) => words.push({ p, w })));
  return { paragraphs, words };
}

/** Build the paragraph-grouped text for words[start, end). */
function sliceToParas(words: ParsedBody['words'], start: number, end: number): string[] {
  const out: string[] = [];
  let curP = -1;
  for (let i = start; i < end; i++) {
    const { p, w } = words[i];
    if (p !== curP) {
      out.push(w);
      curP = p;
    } else {
      out[out.length - 1] += ' ' + w;
    }
  }
  return out;
}

export interface Measurer {
  /** Rendered height (px) of these paragraphs at the given column width. */
  measureParas(paras: string[], widthPx: number): number;
}

/**
 * Pour `body` through the band's column runs. Greedy fill with a binary search
 * at each run boundary (largest word-prefix whose rendered height ≤ run
 * height). Returns the per-run text slices plus whether everything fit and, if
 * not, the cut point + remainder (the Phase 2B contract).
 */
export function layoutBand(body: string | undefined, geo: BandGeometry, measurer: Measurer): LayoutResult {
  const parsed = parseBody(body);
  const total = parsed.words.length;
  const runs = computeRuns(geo);
  const rects = columnRects(geo.contentWidthPx, geo.columns, geo.gapPx);

  const out: RunSlice[] = [];
  let cursor = 0;

  for (const run of runs) {
    const col = rects[run.colIdx];
    // Runaround segments (beside a corner ad) carry their own x/w.
    const rect: ColumnRect =
      run.xPx != null && run.wPx != null ? { x: run.xPx, w: run.wPx } : col;
    // Does this run start a fresh paragraph, or continue one from the previous
    // column? (Continuations must not be indented.)
    const startsParagraph =
      cursor === 0 || cursor >= total || parsed.words[cursor].p !== parsed.words[cursor - 1].p;
    if (cursor >= total) {
      out.push({ ...run, x: rect.x, w: rect.w, text: '', startsParagraph });
      continue;
    }
    // Binary search the largest end (cursor..total] that fits run height.
    let lo = cursor;
    let hi = total;
    let best = cursor; // at least 0 words
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (mid <= cursor) {
        lo = cursor + 1;
        continue;
      }
      const h = measurer.measureParas(sliceToParas(parsed.words, cursor, mid), rect.w);
      if (h <= run.heightPx) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const text = sliceToParas(parsed.words, cursor, best).join('\n\n');
    out.push({ ...run, x: rect.x, w: rect.w, text, startsParagraph });
    cursor = best;
  }

  if (cursor >= total) {
    return { runs: out, fits: true, overflow: null, consumedChars: charCount(parsed, 0, total) };
  }
  const cut = parsed.words[cursor];
  return {
    runs: out,
    fits: false,
    overflow: {
      paragraphIndex: cut.p,
      wordIndex: cursor,
      remainderText: sliceToParas(parsed.words, cursor, total).join('\n\n'),
    },
    consumedChars: charCount(parsed, 0, cursor),
  };
}

function charCount(parsed: ParsedBody, start: number, end: number): number {
  let n = 0;
  for (let i = start; i < end; i++) n += parsed.words[i].w.length + 1;
  return n;
}

/**
 * Closed-form estimate of the body height a band needs to fit all its text in
 * `columns` columns around its photo, plus one refine pass via the measurer.
 * Used for auto-height bands (band_height === null).
 */
export function estimateBodyHeight(
  body: string | undefined,
  geo: Omit<BandGeometry, 'bodyHeightPx'>,
  measurer: Measurer
): number {
  const parsed = parseBody(body);
  const photoBottom = geo.photo ? geo.photo.top + geo.photo.height : 0;
  const adH = geo.cornerAd ? geo.cornerAd.heightPx : 0;
  // A band carrying a corner ad must at least hold the ad plus one text line
  // above it (the ad is pinned to the band bottom).
  const lo0 = Math.max(
    BODY_LINE_HEIGHT_PX,
    Math.ceil(photoBottom),
    adH > 0 ? Math.ceil(adH + BODY_LINE_HEIGHT_PX) : 0
  );
  if (parsed.words.length === 0) return lo0;

  // Closed-form seed: total single-column text height ÷ columns is very close
  // to the balanced height. Then expand by whole lines until it fits and
  // binary-search that last line band to 1px, so the columns pack full and the
  // article ends near the bottom-right (the "journalism" look) — cheaply enough
  // to run live as the editor types.
  const colW = columnWidthPx(geo.contentWidthPx, geo.columns, geo.gapPx);
  const totalTextH = measurer.measureParas(
    parsed.paragraphs.map((p) => p.join(' ')),
    colW
  );
  const photoH = geo.photo ? geo.photo.height : 0;
  const photoSpan = geo.photo ? geo.photo.colSpan : 0;
  // Effective columns lost to the ad: a partly-covered column keeps its
  // runaround strip, so count only the covered fraction.
  let adSpan = 0;
  if (geo.cornerAd) {
    const ad = geo.cornerAd;
    const rects = columnRects(geo.contentWidthPx, geo.columns, geo.gapPx);
    for (let c = ad.colStart0; c < ad.colStart0 + ad.colSpan; c++) {
      const ra = cornerAdRunaround(rects[c], ad, geo.gapPx);
      adSpan += ra ? 1 - ra.wPx / rects[c].w : 1;
    }
  }
  const fits = (h: number) => layoutBand(body, { ...geo, bodyHeightPx: h }, measurer).fits;

  let hi = Math.max(lo0, Math.ceil((totalTextH + photoSpan * photoH + adSpan * adH) / geo.columns));
  let guard = 0;
  while (hi < CONTENT_H_PX && guard++ < 80 && !fits(hi)) {
    hi = Math.min(CONTENT_H_PX, hi + BODY_LINE_HEIGHT_PX);
  }

  let a = Math.max(lo0, hi - BODY_LINE_HEIGHT_PX);
  let b = hi;
  let best = hi;
  while (a <= b) {
    const mid = (a + b) >> 1;
    if (fits(mid)) {
      best = mid;
      b = mid - 1;
    } else {
      a = mid + 1;
    }
  }
  return best;
}

export function snapToLine(px: number): number {
  return Math.ceil(px / BODY_LINE_HEIGHT_PX) * BODY_LINE_HEIGHT_PX;
}
