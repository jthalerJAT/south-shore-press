import { createClient } from '@/lib/supabase/server';
import { PRINT_ONLY_SLUG } from '@/lib/site-config';

// PostgREST array literal used to EXCLUDE print-edition-only stories from
// every public query: `categories=not.cs.{print-only}`.
const NOT_PRINT_ONLY = `{${PRINT_ONLY_SLUG}}`;

/**
 * Server-side story queries. All run from React Server Components or
 * generateMetadata — they use the cookie-aware server Supabase client
 * but only read PUBLIC data (status='published'), so anonymous fetches
 * work even without an auth session.
 *
 * v1 schema, copied verbatim from the v1 SPA's lib/api.js:
 *   stories(
 *     id uuid PK,
 *     headline text,
 *     subline text,
 *     byline text,
 *     body text,
 *     hero_photo_url text,           -- may be photo URL OR YouTube URL
 *     extra_photo_urls text[],
 *     categories text[],             -- e.g. ['local','sports']
 *     status enum(draft|submitted|published|unpublished),
 *     published_at timestamptz,
 *     created_at timestamptz,
 *     author_id uuid FK profiles.id
 *   )
 *   profiles( id, email, display_name, role )
 */

export type StoryListItem = {
  id: string;
  headline: string;
  subline: string | null;
  byline: string | null;
  hero_photo_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

export type StoryDetail = StoryListItem & {
  body: string | null;
  extra_photo_urls: string[] | null;
  created_at: string;
  author_id: string | null;
  author: { display_name: string | null } | null;
};

const LIST_COLUMNS =
  'id, headline, subline, byline, hero_photo_url, categories, published_at';

const DETAIL_COLUMNS = `
  id, headline, subline, byline, body, hero_photo_url, extra_photo_urls,
  categories, status, published_at, created_at, author_id,
  author:profiles!stories_author_id_fkey(display_name)
`;

/** Most recent N published stories across all sections. Used by the
 *  homepage hero + the "Latest" rail. */
export async function getLatestPublishedStories(
  limit: number
): Promise<StoryListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(LIST_COLUMNS)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('categories', 'cs', NOT_PRINT_ONLY)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[getLatestPublishedStories]', error);
    return [];
  }
  return (data ?? []) as StoryListItem[];
}

/**
 * Recent stories for the "Top Stories" sidebar on the homepage.
 *
 * For now this is just `most-recent-after-offset` — by passing
 * offset=5 + limit=10 from the homepage, we get positions 6-15 in the
 * published list (the hero carousel uses 1-5). When we add view counts
 * or an editor-pinned flag we'll point this at that signal instead.
 *
 * Range params on Supabase: .range(from, to) is inclusive on both ends.
 */
export async function getTopStories(
  offset: number,
  limit: number
): Promise<StoryListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(LIST_COLUMNS)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('categories', 'cs', NOT_PRINT_ONLY)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error('[getTopStories]', error);
    return [];
  }
  return (data ?? []) as StoryListItem[];
}

/** Most recent N published stories in a given section. The section comes
 *  from the URL — we match against the `categories` array (Postgres
 *  `contains` semantics via the `cs` Supabase operator). */
export async function getPublishedStoriesBySection(
  section: string,
  limit: number
): Promise<StoryListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(LIST_COLUMNS)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .contains('categories', [section])
    .not('categories', 'cs', NOT_PRINT_ONLY)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[getPublishedStoriesBySection]', error);
    return [];
  }
  return (data ?? []) as StoryListItem[];
}

/**
 * Fetch a single published story by the 8-char short id (first 8 hex
 * chars of the UUID). UUIDs aren't natively prefix-searchable through
 * the Supabase JS / PostgREST surface — `.filter('id::text', 'like', ...)`
 * does NOT work (PostgREST doesn't accept `column::type` in the column
 * field of the filter helper, so the cast is rejected and every query
 * errors). Use a byte-range query instead: uuid comparison in Postgres
 * is lexicographic, so `id >= '<short>-0000-...-0' AND id <= '<short>-
 * ffff-...-f'` matches exactly the UUIDs whose first 8 hex chars equal
 * the short id, and the PK index is used efficiently.
 *
 * Collision handling: in the extremely unlikely event two stories share
 * a short id, we pick the most-recent published one. This can be
 * hardened once we add a real `slug` column.
 */
export async function getPublishedStoryByShortId(
  shortId: string
): Promise<StoryDetail | null> {
  if (!/^[a-f0-9]{8}$/.test(shortId)) return null;

  const supabase = createClient();
  const lower = `${shortId}-0000-0000-0000-000000000000`;
  const upper = `${shortId}-ffff-ffff-ffff-ffffffffffff`;

  const { data, error } = await supabase
    .from('stories')
    .select(DETAIL_COLUMNS)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('categories', 'cs', NOT_PRINT_ONLY)
    .gte('id', lower)
    .lte('id', upper)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getPublishedStoryByShortId]', error);
    return null;
  }
  // Cast through `unknown` — Supabase types FK relations as arrays even
  // when the cardinality is many-to-one (one author per story); the
  // runtime shape is a single object, matching our StoryDetail.
  return ((data ?? null) as unknown as StoryDetail | null) ?? null;
}
