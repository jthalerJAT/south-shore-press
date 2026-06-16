/**
 * Newspaper page templates — the tile structure for each kind of page, plus
 * the default set of pages seeded for the single current working issue.
 * Pure constants — safe to import from both server actions and client
 * components.
 */

export type NpKind =
  | 'front'
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

export type NpTemplate = {
  label: string;
  /** Named tiles a story drops into in order, or 'open' for an unbounded
   *  list of individual stories (Sports, generic pages, etc.). */
  slots: SlotDef[] | 'open';
};

export const NEWSPAPER_TEMPLATES: Record<NpKind, NpTemplate> = {
  front: {
    label: 'Front Page',
    slots: [
      { key: 'main', label: 'Main Story' },
      { key: 'lower1', label: 'Lower Tile 1' },
      { key: 'lower2', label: 'Lower Tile 2' },
      { key: 'lower3', label: 'Lower Tile 3' },
    ],
  },
  page2: {
    label: 'Page 2',
    slots: [
      { key: 'main_oped', label: 'Main OpEd' },
      { key: 'lower_story', label: 'Lower Story' },
      { key: 'lower_ad', label: 'Lower Ad' },
    ],
  },
  generic: { label: 'Page', slots: 'open' },
  legals: { label: 'Legals', slots: 'open' },
  classifieds: { label: 'Classifieds', slots: 'open' },
  fun_times: {
    label: 'Fun Times',
    slots: [
      { key: 'movies', label: 'Movies' },
      { key: 'comics', label: 'Comics' },
      { key: 'history', label: 'History' },
      { key: 'puzzles', label: 'Puzzles' },
    ],
  },
  fantasy_baseball: { label: 'Fantasy Baseball', slots: 'open' },
  betting_barton: { label: 'Betting With Barton', slots: 'open' },
  sports: { label: 'Sports', slots: 'open' },
  back: {
    label: 'Back Page',
    slots: [
      { key: 'main', label: 'Main Story' },
      { key: 'lower1', label: 'Lower Tile 1' },
      { key: 'lower2', label: 'Lower Tile 2' },
      { key: 'lower3', label: 'Lower Tile 3' },
    ],
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
  { kind: 'sports', title: 'Sports' },
  { kind: 'back', title: 'Back Page' },
];

export function templateFor(kind: string): NpTemplate {
  return NEWSPAPER_TEMPLATES[(kind as NpKind)] ?? NEWSPAPER_TEMPLATES.generic;
}

/** True if the page uses an unbounded open list of stories rather than fixed
 *  named tiles. */
export function isOpenKind(kind: string): boolean {
  return templateFor(kind).slots === 'open';
}

export const AD_SIZES = [
  { value: 'full', label: 'Full Page' },
  { value: 'half', label: 'Half Page' },
  { value: 'quarter', label: 'Quarter Page' },
] as const;

export type AdSize = (typeof AD_SIZES)[number]['value'];
