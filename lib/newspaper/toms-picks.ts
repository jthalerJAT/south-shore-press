/**
 * "Tom's Picks" page template data (publisher direction 2026-11-15).
 *
 * A single full page built around Tom Barton's weekend handicapping column:
 *   - a header band: circular headshot + the column logotype, over a rule,
 *   - a short standing bio paragraph,
 *   - two columns of picks (college / pro), THREE tiles each; a tile is a
 *     team logo, a pick line ("Ohio State +10") and a short blurb,
 *   - a standing legal disclaimer along the bottom.
 *
 * The column count and tiles-per-column are FIXED by the design: the page has
 * to fill an exact 10x14in text box, so the renderer divides the available
 * height by TILES_PER_COLUMN rather than letting the list grow. Empty tiles
 * render as blanks (and as dashed drop targets while editing) instead of
 * collapsing, which keeps the grid square week to week.
 *
 * Client-safe — no server imports.
 */

export const TILES_PER_COLUMN = 3;

export type PickTile = {
  id: string;
  /** Team logo — public URL in the newspaper-images bucket, or pasted. */
  logo_url: string;
  /** The pick itself: "Ohio State +10", "Jets/Bills UNDER 41.5". */
  title: string;
  /** Two or three sentences of reasoning under the pick. */
  blurb: string;
};

export type TomsPicksData = {
  v: 1;
  /** Logotype across the header. */
  headline: string;
  /** Tom's headshot — rendered in a circle, so a square crop reads best. */
  photo_url: string;
  bio: string;
  college_label: string;
  pro_label: string;
  college: PickTile[];
  pro: PickTile[];
  disclaimer: string;
};

export const DEFAULT_TOMS_PICKS_HEADLINE = "Tom's Picks";
export const DEFAULT_COLLEGE_LABEL = 'COLLEGE';
export const DEFAULT_PRO_LABEL = 'PRO';

/** Standing bio. "@xxx" is a deliberate placeholder — Tom's X handle was not
 *  supplied when the template was built (2026-11-15); fill it before the page
 *  runs. */
export const DEFAULT_TOMS_PICKS_BIO =
  'Tom Barton is not only the sports columnist for the South Shore Press, he is a ' +
  'nationally known sports handicapper whose history of picking winners is among the ' +
  'elite. Follow Tom at @xxx, and also at the South Shore Press. Here are Tom’s ' +
  'picks for this weekend.';

/** Standing disclaimer. Carries the New York problem-gambling hotline, which
 *  is the line that matters if this page ever draws a complaint. */
export const DEFAULT_TOMS_PICKS_DISCLAIMER =
  'DISCLAIMER: The selections on this page are the opinions of Tom Barton and are ' +
  'published for entertainment and informational purposes only. Nothing here is ' +
  'betting, gambling, financial or investment advice, and The South Shore Press makes ' +
  'no guarantee as to the outcome of any contest. Past performance does not predict ' +
  'future results. You must be 21 or older to wager in New York State. If you or ' +
  'someone you know has a gambling problem, call the New York Problem Gambling HOPEline ' +
  'at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).';

export function emptyPickTile(id: string): PickTile {
  return { id, logo_url: '', title: '', blurb: '' };
}

function emptyColumn(prefix: string): PickTile[] {
  return Array.from({ length: TILES_PER_COLUMN }, (_, i) => emptyPickTile(`${prefix}-${i}`));
}

export function defaultTomsPicks(): TomsPicksData {
  return {
    v: 1,
    headline: DEFAULT_TOMS_PICKS_HEADLINE,
    photo_url: '',
    bio: DEFAULT_TOMS_PICKS_BIO,
    college_label: DEFAULT_COLLEGE_LABEL,
    pro_label: DEFAULT_PRO_LABEL,
    college: emptyColumn('college'),
    pro: emptyColumn('pro'),
    disclaimer: DEFAULT_TOMS_PICKS_DISCLAIMER,
  };
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** Normalize one column to EXACTLY TILES_PER_COLUMN entries — pad short lists
 *  with blanks and drop the overflow — so the renderer can divide the page
 *  height without measuring. */
function normalizeColumn(raw: unknown, prefix: string): PickTile[] {
  const src = Array.isArray(raw) ? raw : [];
  return Array.from({ length: TILES_PER_COLUMN }, (_, i) => {
    const t = src[i];
    if (!t || typeof t !== 'object') return emptyPickTile(`${prefix}-${i}`);
    const p = t as Record<string, unknown>;
    return {
      id: str(p.id) || `${prefix}-${i}`,
      logo_url: str(p.logo_url),
      title: str(p.title),
      blurb: str(p.blurb),
    };
  });
}

export function normalizeTomsPicks(raw: unknown): TomsPicksData {
  if (!raw || typeof raw !== 'object') return defaultTomsPicks();
  const r = raw as Record<string, unknown>;
  // A field that exists but is blank is a deliberate clear and is kept blank;
  // a field that is MISSING falls back to the standing copy. `bio` and
  // `disclaimer` are the ones that matter — an editor who wipes the
  // disclaimer should not have it silently reappear next week.
  return {
    v: 1,
    headline: str(r.headline).trim() ? str(r.headline) : DEFAULT_TOMS_PICKS_HEADLINE,
    photo_url: str(r.photo_url),
    bio: 'bio' in r ? str(r.bio) : DEFAULT_TOMS_PICKS_BIO,
    college_label: str(r.college_label).trim() ? str(r.college_label) : DEFAULT_COLLEGE_LABEL,
    pro_label: str(r.pro_label).trim() ? str(r.pro_label) : DEFAULT_PRO_LABEL,
    college: normalizeColumn(r.college, 'college'),
    pro: normalizeColumn(r.pro, 'pro'),
    disclaimer: 'disclaimer' in r ? str(r.disclaimer) : DEFAULT_TOMS_PICKS_DISCLAIMER,
  };
}
