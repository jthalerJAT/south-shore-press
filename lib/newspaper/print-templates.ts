/**
 * Print layout specs — the "master InDesign template" per page kind, expressed
 * as data (frames in POINTS + type styles + a `bind` naming which content
 * field fills each frame). The UXP plugin builds an InDesign page from
 * spec + content data, so this is the single, reusable, DB-overridable source
 * of truth for the print layout.
 *
 * Geometry is derived from the on-screen wireframe (components/newspaper/
 * section-cover.tsx, 96-dpi px) converted to PostScript points: pt = px × 0.75.
 * Page = 11×15in = 792×1080 pt; margins 0.5in = 36 pt; content 720×1008 pt.
 */

export type PrintStyle = {
  font?: string;
  fontStyle?: string; // e.g. 'Bold', 'Italic'
  size?: number;
  leading?: number;
  fill?: string; // hex, text colour or rect fill
  stroke?: string; // hex, text outline
  strokeWeight?: number; // pt
  align?: 'left' | 'center' | 'right';
  /** Vertical text alignment within the frame. */
  vAlign?: 'top' | 'center' | 'bottom';
  uppercase?: boolean;
};

export type PrintElement = {
  type: 'text' | 'image' | 'rect' | 'line';
  /** [x, y, w, h] in points (page coords; in `tiles.template`, cell-relative —
   *  w/h ≤ 0 means cellW/regionH + that value, x/y are offsets in the cell). */
  bounds: [number, number, number, number];
  /** Dot-path into the content data, e.g. 'hero.headline', 'year_issue'. In a
   *  tile template, a bare key into the tile object, e.g. 'headline'. */
  bind?: string;
  /** Literal text (used when there's no bind). */
  value?: string;
  /** Prefix prepended to resolved text, e.g. 'PAGE ', 'Story on pg. '. */
  prefix?: string;
  /** Skip the element entirely when its bound value is empty. */
  skipIfEmpty?: boolean;
  /** Image fit. */
  fit?: 'fill' | 'contain';
  style?: PrintStyle;
};

export type PrintSpec = {
  v: 1;
  kind: string;
  page: { w: number; h: number };
  margin: number;
  elements: PrintElement[];
  tiles?: {
    region: [number, number, number, number];
    gap: number;
    regionFill?: string;
    /** Cell-relative elements rendered once per visible tile. */
    template: PrintElement[];
  };
};

const BLACK = '#111111';
const WHITE = '#ffffff';
const BRAND_RED = '#c8102e';
const SSP_BLUE = '#1559b0';
const NAVY = '#0b2a4a';
const HEADLINE_FONT = 'Arial';
// Crimson Text matches the printed paper's editorial serif (install it in
// InDesign; it substitutes if missing).
const BODY_FONT = 'Crimson Text';

export const FRONT_PRINT_SPEC: PrintSpec = {
  v: 1,
  kind: 'front',
  page: { w: 792, h: 1080 },
  margin: 36,
  elements: [
    // ── Header (full-width masthead, near the top edge, tight to the line) ─
    // `fill` crops the source PNG's ~16% transparent top/bottom padding so the
    // artwork sits edge-to-edge (frame aspect ~5.5:1 ≈ the artwork's).
    { type: 'image', bounds: [36, 24, 720, 131], bind: 'logo_url', fit: 'fill' },
    { type: 'text', bounds: [36, 159, 230, 16], bind: 'year_issue', style: { font: BODY_FONT, fontStyle: 'Bold', size: 11, fill: BLACK } },
    { type: 'text', bounds: [36, 159, 720, 16], bind: 'tagline', style: { font: BODY_FONT, fontStyle: 'Italic', size: 10, align: 'center', fill: BLACK } },
    { type: 'text', bounds: [526, 159, 230, 16], bind: 'issue_date', style: { font: BODY_FONT, fontStyle: 'Bold', size: 11, align: 'right', uppercase: true, fill: BLACK } },
    { type: 'rect', bounds: [36, 179, 720, 2], style: { fill: BLACK } },

    // ── Hero ────────────────────────────────────────────────
    { type: 'image', bounds: [36, 185, 720, 667], bind: 'hero.photo_url', fit: 'fill' },
    { type: 'text', bounds: [44, 680, 668, 124], bind: 'hero.headline', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold', size: 64, leading: 60, uppercase: true, vAlign: 'bottom', fill: WHITE, stroke: BLACK, strokeWeight: 2 } },
    { type: 'text', bounds: [44, 806, 668, 28], bind: 'hero.subhead', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold', size: 26, vAlign: 'center', fill: WHITE, stroke: BLACK, strokeWeight: 1 } },
    { type: 'text', bounds: [44, 836, 420, 13], bind: 'hero.credit', prefix: 'Credit: ', skipIfEmpty: true, style: { font: BODY_FONT, fontStyle: 'Bold', size: 9, vAlign: 'center', fill: WHITE } },
    { type: 'rect', bounds: [620, 818, 136, 30], bind: 'hero.page_ref', skipIfEmpty: true, style: { fill: BRAND_RED } },
    { type: 'text', bounds: [620, 818, 136, 30], bind: 'hero.page_ref', prefix: 'PAGE ', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold', size: 20, align: 'center', vAlign: 'center', fill: WHITE } },

    // ── Bottom banner ───────────────────────────────────────
    { type: 'rect', bounds: [36, 1017, 720, 27], bind: 'banner_text', skipIfEmpty: true, style: { fill: NAVY } },
    { type: 'text', bounds: [40, 1017, 712, 27], bind: 'banner_text', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold Italic', size: 14, align: 'center', vAlign: 'center', fill: WHITE } },
  ],
  tiles: {
    region: [36, 852, 720, 165],
    gap: 6,
    regionFill: SSP_BLUE,
    // Full-bleed photo fills the tile; text overlaid at the bottom.
    template: [
      { type: 'image', bounds: [0, 0, 0, 0], bind: 'photo_url', fit: 'fill' },
      { type: 'rect', bounds: [4, 4, 74, 16], bind: 'section_label', skipIfEmpty: true, style: { fill: NAVY } },
      { type: 'text', bounds: [8, 5, 70, 14], bind: 'section_label', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold', size: 9, fill: WHITE, uppercase: true } },
      { type: 'text', bounds: [5, 112, -10, 38], bind: 'headline', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold', size: 15, leading: 15, vAlign: 'bottom', fill: WHITE, stroke: BLACK, strokeWeight: 0.5 } },
      { type: 'text', bounds: [5, 151, -56, 11], bind: 'credit', prefix: 'Credit: ', skipIfEmpty: true, style: { font: BODY_FONT, size: 8, vAlign: 'center', fill: WHITE, stroke: BLACK, strokeWeight: 0.3 } },
      { type: 'text', bounds: [4, 151, -6, 11], bind: 'page_ref', prefix: 'Story on pg. ', skipIfEmpty: true, style: { font: HEADLINE_FONT, fontStyle: 'Bold', size: 9, align: 'right', vAlign: 'center', fill: WHITE, stroke: BLACK, strokeWeight: 0.3 } },
    ],
  },
};

/** The built-in default spec for a kind, or null if none is authored yet.
 *  (The print API serves a DB row from np_print_templates when present, else
 *  this fallback.) */
export function getPrintSpec(kind: string): PrintSpec | null {
  if (kind === 'front' || kind === 'sports_cover') return { ...FRONT_PRINT_SPEC, kind };
  return null;
}
