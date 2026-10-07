/**
 * Election page template data — the "Election Issue" voter-guide section
 * (publisher direction 2026-10-07). The SECTION spans several consecutive
 * `election` pages (budgeted at 6, pages 3–8 of the election lineup), but the
 * content is edited ONCE as a single list of race tiles: the section data —
 * intro + tiles — lives in the FIRST election page's template_data, and every
 * election page renders from it. Pagination packs WHOLE tiles onto pages in
 * order; a tile that doesn't fit on a page becomes the first tile of the next
 * page (tiles never split across a page break). Client-safe (no server
 * imports).
 */

export type ElectionCandidate = {
  /** Party label on the colored band — free text (REPUBLICAN / DEMOCRAT /
   *  CONSERVATIVE / …). The band color is fixed by position: red left,
   *  blue right. */
  party: string;
  name: string;
  /** Public URL in the newspaper-images bucket (or pasted external URL). */
  photo_url: string;
  bio: string;
};

export type ElectionTile = {
  id: string;
  /** Navy band — "COUNTY TREASURER" etc. */
  race: string;
  /** Red band — "SOUTH SHORE PRESS VERDICT: <verdict>". */
  verdict: string;
  /** The endorsement rationale under the verdict band — grows with the text. */
  rationale: string;
  left: ElectionCandidate;
  right: ElectionCandidate;
};

export type ElectionSectionData = {
  v: 1;
  /** Optional description box at the top of the section's first page.
   *  null = removed. */
  intro: string | null;
  intro_title: string;
  /** Section flag label on every election page. */
  section_label: string;
  /** Navy bar at the bottom of every election page. */
  footer_label: string;
  tiles: ElectionTile[];
};

export const DEFAULT_ELECTION_SECTION_LABEL = 'ELECTION 2026';
export const DEFAULT_ELECTION_FOOTER = 'GENERAL ELECTION • SOUTH SHORE PRESS VOTER GUIDE';
export const DEFAULT_ELECTION_INTRO_TITLE = 'Your Guide to the Ballot';

export function emptyCandidate(party: string): ElectionCandidate {
  return { party, name: '', photo_url: '', bio: '' };
}

export function emptyTile(id: string): ElectionTile {
  return {
    id,
    race: '',
    verdict: '',
    rationale: '',
    left: emptyCandidate('REPUBLICAN'),
    right: emptyCandidate('DEMOCRAT'),
  };
}

export function defaultElectionSection(): ElectionSectionData {
  return {
    v: 1,
    intro: '',
    intro_title: DEFAULT_ELECTION_INTRO_TITLE,
    section_label: DEFAULT_ELECTION_SECTION_LABEL,
    footer_label: DEFAULT_ELECTION_FOOTER,
    tiles: [],
  };
}

function normalizeCandidate(raw: unknown, fallbackParty: string): ElectionCandidate {
  if (!raw || typeof raw !== 'object') return emptyCandidate(fallbackParty);
  const r = raw as Record<string, unknown>;
  return {
    party: typeof r.party === 'string' ? r.party : fallbackParty,
    name: typeof r.name === 'string' ? r.name : '',
    photo_url: typeof r.photo_url === 'string' ? r.photo_url : '',
    bio: typeof r.bio === 'string' ? r.bio : '',
  };
}

export function normalizeElectionSection(raw: unknown): ElectionSectionData {
  if (!raw || typeof raw !== 'object') return defaultElectionSection();
  const r = raw as Partial<ElectionSectionData> & Record<string, unknown>;
  const tiles: ElectionTile[] = Array.isArray(r.tiles)
    ? (r.tiles as unknown[]).flatMap((t, i): ElectionTile[] => {
        if (!t || typeof t !== 'object') return [];
        const p = t as Record<string, unknown>;
        return [
          {
            id: typeof p.id === 'string' && p.id ? p.id : `race-${i}`,
            race: typeof p.race === 'string' ? p.race : '',
            verdict: typeof p.verdict === 'string' ? p.verdict : '',
            rationale: typeof p.rationale === 'string' ? p.rationale : '',
            left: normalizeCandidate(p.left, 'REPUBLICAN'),
            right: normalizeCandidate(p.right, 'DEMOCRAT'),
          },
        ];
      })
    : [];
  return {
    v: 1,
    intro: typeof r.intro === 'string' ? r.intro : null,
    intro_title:
      typeof r.intro_title === 'string' && r.intro_title.trim()
        ? r.intro_title
        : DEFAULT_ELECTION_INTRO_TITLE,
    section_label:
      typeof r.section_label === 'string' && r.section_label.trim()
        ? r.section_label
        : DEFAULT_ELECTION_SECTION_LABEL,
    footer_label:
      typeof r.footer_label === 'string' && r.footer_label.trim()
        ? r.footer_label
        : DEFAULT_ELECTION_FOOTER,
    tiles,
  };
}
