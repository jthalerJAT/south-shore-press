import { createClient } from '@/lib/supabase/server';

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
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[getLatestPublishedStories]', error);
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
 * chars of the UUID, dashes stripped). UUIDs aren't natively prefix-
 * searchable in Postgres, so we cast to text and use LIKE — fine at the
 * scale of one DB row per request, and the planner uses the PK index for
 * the equality bits.
 *
 * Collision handling: in the extremely unlikely event two stories share a
 * short id, we pick the most-recent published one. This can be hardened
 * once we add a real `slug` column.
 */
export async function getPublishedStoryByShortId(
  shortId: string
): Promise<StoryDetail | null> {
  if (!/^[a-f0-9]{8}$/.test(shortId)) return null;

  const supabase = createClient();
  // Re-introduce the dash so the prefix matches the canonical UUID text
  // form. UUID v4 always has a dash after the first 8 chars.
  const idPrefix = `${shortId.slice(0, 8)}-%`;

  const { data, error } = await supabase
    .from('stories')
    .select(DETAIL_COLUMNS)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .filter('id::text', 'like', idPrefix)
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
