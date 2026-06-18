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
  | 'generic'
  | 'legals'
  | 'classifieds'
  | 'fun_times'
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
export type TemplateId = 'section_cover' | 'oped';

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
  generic: { label: 'Page', slots: 'open', mode: 'flow', master: false },
  legals: { label: 'Legals', slots: 'open', mode: 'flow', master: true },
  classifieds: { label: 'Classifieds', slots: 'open', mode: 'flow', master: true },
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

/** The pages seeded for a fresh issue, in order. "Add New Page" inserts a
 *  `generic` page in the front-matter run (after the last generic, before
 *  Legals). */
export const DEFAULT_PAGES: ReadonlyArray<{ kind: NpKind; title: string }> = [
  { kind: 'front', title: 'Front Page' },
  { kind: 'page2', title: 'Page 2' },
  { kind: 'generic', title: 'Page 3' },
  { kind: 'legals', title: 'Legals' },
  { kind: 'classifieds', title: 'Classifieds' },
  { kind: 'fun_times', title: 'Fun Times' },
  { kind: 'fantasy_baseball', title: 'Fantasy Baseball' },
  { kind: 'betting_barton', title: 'Betting With Barton' },
  { kind: 'sports_cover', title: 'Sports Cover' },
  { kind: 'sports', title: 'Sports' },
  { kind: 'back', title: 'Back Page' },
];

export function templateFor(kind: string): NpTemplate {
  return NEWSPAPER_TEMPLATES[kind as NpKind] ?? NEWSPAPER_TEMPLATES.generic;
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
  { kind: 'sports_cover', label: 'Sports Cover' },
];

export const AD_SIZES = [
  { value: 'full', label: 'Full Page' },
  { value: 'half', label: 'Half Page' },
  { value: 'quarter', label: 'Quarter Page' },
] as const;

export type AdSize = (typeof AD_SIZES)[number]['value'];
