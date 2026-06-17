/**
 * Section-cover template data — the structured fields behind the Front Page
 * and section covers (Sports, …). Stored in np_pages.template_data. Pure
 * helpers, safe on server + client.
 */
import { coverConfig, type CoverConfig } from '@/lib/newspaper-templates';

export type CoverTile = {
  section_label?: string;
  photo_url?: string;
  headline?: string;
  page_ref?: string;
  credit?: string;
};

export type CoverHero = {
  photo_url?: string;
  credit?: string;
  headline?: string;
  subhead?: string;
  page_ref?: string;
};

export type SectionCoverData = {
  v: 1;
  /** Issue header — the Front Page is the source of truth; later pages read it. */
  year_issue?: string;
  tagline?: string;
  issue_date?: string;
  hero: CoverHero;
  tile_count: 0 | 1 | 2 | 3;
  tiles: CoverTile[];
  banner_text?: string;
};

export function defaultCover(kind: string): SectionCoverData {
  const cfg: CoverConfig | null = coverConfig(kind);
  const label = cfg?.defaultTabLabel ?? 'LOCAL';
  return {
    v: 1,
    year_issue: '',
    tagline: cfg?.defaultTagline ?? '',
    issue_date: '',
    hero: {},
    tile_count: 3,
    tiles: [
      { section_label: label },
      { section_label: label },
      { section_label: label },
    ],
    banner_text: cfg?.defaultBanner ?? '',
  };
}

function clampCount(n: unknown): 0 | 1 | 2 | 3 {
  const v = Math.round(typeof n === 'number' ? n : 3);
  return (v < 0 ? 0 : v > 3 ? 3 : v) as 0 | 1 | 2 | 3;
}

/** Merge a raw jsonb blob over the defaults so a missing field never crashes. */
export function normalizeCover(raw: unknown, kind: string): SectionCoverData {
  const base = defaultCover(kind);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SectionCoverData>;
  const tile_count = r.tile_count != null ? clampCount(r.tile_count) : base.tile_count;
  const tiles: CoverTile[] = Array.from({ length: 3 }, (_, i) => ({
    ...base.tiles[i],
    ...(Array.isArray(r.tiles) ? r.tiles[i] : undefined),
  }));
  return {
    v: 1,
    year_issue: r.year_issue ?? base.year_issue,
    tagline: r.tagline ?? base.tagline,
    issue_date: r.issue_date ?? base.issue_date,
    hero: { ...base.hero, ...(r.hero ?? {}) },
    tile_count,
    tiles,
    banner_text: r.banner_text ?? base.banner_text,
  };
}

type StorySource = {
  headline?: string | null;
  byline?: string | null;
  hero_photo_url?: string | null;
  categories?: string[] | null;
};

/** Fill the hero if empty, else the next empty tile, from a story. Returns a
 *  new SectionCoverData (does not mutate). */
export function fillSlotFromStory(
  data: SectionCoverData,
  story: StorySource
): SectionCoverData {
  const headline = (story.headline ?? '').trim();
  const photo_url = (story.hero_photo_url ?? '').trim() || undefined;
  const credit = (story.byline ?? '').trim() || undefined;
  const section_label = (story.categories?.[0] ?? '').toUpperCase() || undefined;

  // Hero first if it has no headline + no photo yet.
  if (!data.hero.headline && !data.hero.photo_url) {
    return { ...data, hero: { ...data.hero, headline, photo_url, credit } };
  }
  // Otherwise the next visible empty tile.
  const next = data.tiles
    .slice(0, data.tile_count)
    .findIndex((t) => !t.headline && !t.photo_url);
  if (next === -1) return data;
  const tiles = data.tiles.map((t, i) =>
    i === next ? { ...t, headline, photo_url, credit, section_label: t.section_label ?? section_label } : t
  );
  return { ...data, tiles };
}
