/**
 * Newspaper page templates — the tile structure for each kind of page, plus
 * the default set of pages seeded for the single current working issue.
 * Pure constants — safe to import from both server actions and client
 * components.
 *
 * Each kind has a `mode`:
 *   - 'flow'     — laid out freehand with the Phase 2A column-flow engine
 *                  (np_items + the layout editor). Interior story pages.
 *   - 'template' — a bespoke field form + to-scale wireframe renderer; data
 *                  lives in np_pages.template_data. Repeating "master" pages
 *                  like the Front Page + section covers.
 * and a `master` flag — master pages can't be deleted from an issue (the
 * Delete button is greyed). Generally only newly-added `generic` pages are
 * deletable.
 */

export type NpKind =
  | 'front'
  | 'sports_cover'
  | 'page2'
  | 'oped_page'
  | 'full_page_ad'
  | 'generic'
  | 'legals'
  | 'classifieds'
  | 'fun_times'
  | 'fun_box_office'
  | 'fun_puzzles'
  | 'fun_comics'
  | 'fun_history'
  | 'fantasy_baseball'
  | 'betting_barton'
  | 'sports'
  | 'back';

export type SlotDef = { key: string; label: string };

/** Configuration for a "section cover" template page (Front Page, Sports
 *  cover, …): a hero photo + up to three bottom tiles + a masthead. */
export type CoverConfig = {
  variant: 'news' | 'sports';
  /** News front shows the "42ND YEAR • ISSUE 24" line; section covers don't. */
  showYearIssue: boolean;
  /** Masthead word appended to the logo for section covers (e.g. "Sports"). */
  mastheadWord?: string;
  defaultTagline: string;
  /** Section tab label seeded on tiles ("LOCAL" / "SPORTS"). */
  defaultTabLabel: string;
  defaultBanner: string;
};

/** Which bespoke template editor/renderer a template-mode page uses. */
export type TemplateId = 'section_cover' | 'oped' | 'page_four' | 'full_ad' | 'classified';

export type NpTemplate = {
  label: string;
  /** Named tiles a story drops into in order, or 'open' for an unbounded
   *  list of individual stories (Sports, generic pages, etc.). */
  slots: SlotDef[] | 'open';
  mode: 'flow' | 'template';
  master: boolean;
  /** Bespoke template kind (template-mode pages only). */
  template?: TemplateId;
  /** Present only for section-cover template pages. */
  cover?: CoverConfig;
};

const FRONT_BANNER = 'WELCOME TO THE SOUTH SHORE PRESS! COVERING ALL OF SUFFOLK COUNTY';
const FRONT_TAGLINE = "The People's Newspaper - Covering All of Suffolk County";

export const NEWSPAPER_TEMPLATES: Record<NpKind, NpTemplate> = {
  front: {
    label: 'Front Page',
    slots: 'open',
    mode: 'template',
    master: true,
    template: 'section_cover',
    cover: {
      variant: 'news',
      showYearIssue: true,
      defaultTagline: FRONT_TAGLINE,
      defaultTabLabel: 'LOCAL',
      defaultBanner: FRONT_BANNER,
    },
  },
  sports_cover: {
    label: 'Sports Cover',
    slots: 'open',
    mode: 'template',
    master: true,
    template: 'section_cover',
    cover: {
      variant: 'sports',
      showYearIssue: false,
      mastheadWord: 'Sports',
      defaultTagline: 'SUFFOLK SPORTS Teams, Scores, Photos, News, Columns and More',
      defaultTabLabel: 'SPORTS',
      defaultBanner: '',
    },
  },
  page2: {
    label: 'Page 2',
    slots: [
      { key: 'main_oped', label: 'Main OpEd' },
      { key: 'second_story', label: '2nd Story' },
      { key: 'bottom_ad', label: 'Bottom Ad' },
    ],
    mode: 'template',
    master: true,
    template: 'oped',
  },
  oped_page: {
    label: 'Op-Ed Page',
    slots: 'open',
    mode: 'template',
    master: true,
    template: 'page_four',
  },
  full_page_ad: {
    label: 'Full Page Ad',
    slots: 'open',
    mode: 'template',
    master: true,
    template: 'full_ad',
  },
  generic: { label: 'Page', slots: 'open', mode: 'flow', master: false },
  legals: { label: 'Legals', slots: 'open', mode: 'flow', master: true },
  classifieds: { label: 'Classifieds', slots: 'open', mode: 'template', master: true, template: 'classified' },
  fun_times: {
    label: 'Fun Times',
    slots: [
      { key: 'movies', label: 'Movies' },
      { key: 'comics', label: 'Comics' },
      { key: 'history', label: 'History' },
      { key: 'puzzles', label: 'Puzzles' },
    ],
    mode: 'flow',
    master: true,
  },
  // "Fun Stuff" — four dedicated full-page sections, each fed from its own
  // standalone app (ssp-box-office / ssp-puzzles / ssp-funny-pages / ssp-history)
  // via a per-page "Pull from app" button (integration is a follow-up phase).
  // Flow-mode for now so they render + edit safely as section pages in the shell.
  fun_box_office: { label: 'Box Office', slots: 'open', mode: 'flow', master: true },
  fun_puzzles: { label: 'Puzzles', slots: 'open', mode: 'flow', master: true },
  fun_comics: { label: 'Funny Pages', slots: 'open', mode: 'flow', master: true },
  fun_history: { label: 'This Week in History', slots: 'open', mode: 'flow', master: true },
  fantasy_baseball: { label: 'Fantasy Baseball', slots: 'open', mode: 'flow', master: true },
  betting_barton: { label: 'Betting With Barton', slots: 'open', mode: 'flow', master: true },
  sports: { label: 'Sports', slots: 'open', mode: 'flow', master: true },
  back: {
    label: 'Back Page',
    slots: [
      { key: 'main', label: 'Main Story' },
      { key: 'lower1', label: 'Lower Tile 1' },
      { key: 'lower2', label: 'Lower Tile 2' },
      { key: 'lower3', label: 'Lower Tile 3' },
    ],
    mode: 'flow',
    master: true,
  },
};

/** The pages seeded for a fresh issue, in order — the standard 40-page South
 *  Shore Press flow (2026-07-11). This is what "Rebuild Pages" lays down at the
 *  start of a new week. Structure:
 *    1        Front Page
 *    2        Main Op-Ed (Page 2)
 *    3–6      Local News (4)
 *    7–8      Nation & World News (2)
 *    9–10     Business (2)
 *    11–14    Opinion (4)
 *    15–18    Legals & Classifieds (2 + 2)
 *    19–22    Fun Stuff — Box Office / Puzzles / Funny Pages / History (4)
 *    23–24    Professional Sports (2)
 *    25–28    Local Sports (4)
 *    29–40    Ads — fill the remainder (12)
 *  Interior news/opinion/sports pages are flow pages; `section` seeds the
 *  section-flag header. Editors can rename headers, insert, reorder, convert,
 *  and delete pages from here. */
export const DEFAULT_PAGES: ReadonlyArray<{
  kind: NpKind;
  title: string;
  section?: string;
  /** Seed the publication-info colophon rail on this page (page 5). */
  colophon?: boolean;
}> = [
  { kind: 'front', title: 'Front Page' },
  { kind: 'page2', title: 'Newsroom / Op-Ed' },
  // Local News (4)
  { kind: 'generic', title: 'Local News', section: 'LOCAL NEWS' },
  { kind: 'generic', title: 'Local News', section: 'LOCAL NEWS' },
  { kind: 'generic', title: 'Local News', section: 'LOCAL NEWS', colophon: true },
  { kind: 'generic', title: 'Local News', section: 'LOCAL NEWS' },
  // Nation & World News (2)
  { kind: 'generic', title: 'Nation & World News', section: 'NATION & WORLD NEWS' },
  { kind: 'generic', title: 'Nation & World News', section: 'NATION & WORLD NEWS' },
  // Business (2)
  { kind: 'generic', title: 'Business', section: 'BUSINESS' },
  { kind: 'generic', title: 'Business', section: 'BUSINESS' },
  // Opinion (4)
  { kind: 'generic', title: 'Opinion', section: 'OPINION' },
  { kind: 'generic', title: 'Opinion', section: 'OPINION' },
  { kind: 'generic', title: 'Opinion', section: 'OPINION' },
  { kind: 'generic', title: 'Opinion', section: 'OPINION' },
  // Legals & Classifieds (4)
  { kind: 'legals', title: 'Legal Notices' },
  { kind: 'legals', title: 'Legal Notices' },
  { kind: 'classifieds', title: 'Classifieds' },
  { kind: 'classifieds', title: 'Classifieds' },
  // Fun Stuff (4) — each pulls from its own app in a later phase
  { kind: 'fun_box_office', title: 'Box Office', section: 'BOX OFFICE' },
  { kind: 'fun_puzzles', title: 'Puzzles', section: 'PUZZLES' },
  { kind: 'fun_comics', title: 'Funny Pages', section: 'FUNNY PAGES' },
  { kind: 'fun_history', title: 'This Week in History', section: 'THIS WEEK IN HISTORY' },
  // Professional Sports (2)
  { kind: 'sports', title: 'Professional Sports', section: 'PROFESSIONAL SPORTS' },
  { kind: 'sports', title: 'Professional Sports', section: 'PROFESSIONAL SPORTS' },
  // Local Sports (4)
  { kind: 'sports', title: 'Local Sports', section: 'LOCAL SPORTS' },
  { kind: 'sports', title: 'Local Sports', section: 'LOCAL SPORTS' },
  { kind: 'sports', title: 'Local Sports', section: 'LOCAL SPORTS' },
  { kind: 'sports', title: 'Local Sports', section: 'LOCAL SPORTS' },
  // Ads — fill the remainder to 40 (12)
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
  { kind: 'full_page_ad', title: 'Ad' },
];

export function templateFor(kind: string): NpTemplate {
  return NEWSPAPER_TEMPLATES[kind as NpKind] ?? NEWSPAPER_TEMPLATES.generic;
}

/** Board / editor heading for a page: its descriptive title, falling back to
 *  "Page N" only for a blank/just-added generic page (title 'Page' or empty). */
export function pageHeading(title: string | null | undefined, ordinal: number): string {
  const t = (title ?? '').trim();
  return !t || t === 'Page' ? `Page ${ordinal}` : t;
}

/** True if the page uses an unbounded open list of stories rather than fixed
 *  named tiles. */
export function isOpenKind(kind: string): boolean {
  return templateFor(kind).slots === 'open';
}

/** 'flow' (freehand column layout) vs 'template' (bespoke field form). */
export function pageMode(kind: string): 'flow' | 'template' {
  return templateFor(kind).mode;
}

/** Master pages can't be deleted from an issue. */
export function isMaster(kind: string): boolean {
  return templateFor(kind).master;
}

/** Section-cover config for a template page, or null for flow pages. */
export function coverConfig(kind: string): CoverConfig | null {
  return templateFor(kind).cover ?? null;
}

/** Which bespoke template a template-mode page uses (or null for flow). */
export function templateId(kind: string): TemplateId | null {
  return templateFor(kind).template ?? null;
}

/** Template-mode kinds the "+ Add Page" menu offers (besides a blank page). */
export const ADDABLE_TEMPLATE_KINDS: ReadonlyArray<{ kind: NpKind; label: string }> = [
  { kind: 'oped_page', label: 'Op-Ed Page' },
  { kind: 'sports_cover', label: 'Sports Cover' },
  { kind: 'full_page_ad', label: 'Full Page Ad' },
];

/** Kinds an editor can convert an existing page to (the per-row "Page type"
 *  selector on the board). Excludes the one-off covers (front/sports_cover)
 *  which are seeded, not assigned. */
export const ASSIGNABLE_KINDS: ReadonlyArray<{ kind: NpKind; label: string }> = [
  { kind: 'generic', label: 'Blank (free layout)' },
  { kind: 'oped_page', label: 'Op-Ed Page' },
  { kind: 'page2', label: 'Op-Ed (Page 2 style)' },
  { kind: 'full_page_ad', label: 'Full Page Ad' },
  { kind: 'legals', label: 'Legals' },
  { kind: 'classifieds', label: 'Classifieds' },
  { kind: 'sports', label: 'Sports' },
];

export const AD_SIZES = [
  { value: 'full', label: 'Full Page' },
  { value: 'half', label: 'Half Page' },
  { value: 'third', label: 'One-Third Page' },
  { value: 'quarter', label: 'Quarter Page' },
] as const;

export type AdSize = (typeof AD_SIZES)[number]['value'];

/** Human label for an ad size value ("full" → "Full Page"). */
export function adSizeLabel(value?: string | null): string {
  return AD_SIZES.find((s) => s.value === value)?.label ?? 'Quarter Page';
}
