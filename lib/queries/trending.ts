import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStoriesByIds, type StoryListItem } from '@/lib/queries/stories';

/**
 * Trending stories + the universal "You Might Also Be Interested In" pool.
 *
 * Ranking source: the story_views daily buckets (migration 033), summed over
 * the last 24h (today + yesterday buckets). Cold-start / thin-data fallback:
 * newest published stories site-wide. Every consumer excludes what its page
 * already shows, so the strip never duplicates on-page content.
 */

const LIST_COLUMNS = 'id, headline, subline, byline, hero_photo_url, categories, published_at';

/** Most-viewed published stories in the last ~24h, excluding `exclude` ids.
 *  Tops up with the newest published stories when view data is thin. */
export async function getTrendingStories(
  limit: number,
  exclude: ReadonlySet<string>
): Promise<StoryListItem[]> {
  const ranked: StoryListItem[] = [];

  // 1) View-ranked candidates (service-role — story_views is RLS-locked).
  try {
    const admin = createAdminClient();
    const since = new Date();
    since.setDate(since.getDate() - 1);
    const { data, error } = await admin
      .from('story_views')
      .select('story_id, views, day')
      .gte('day', since.toISOString().slice(0, 10));
    if (!error && data) {
      const totals = new Map<string, number>();
      for (const row of data as Array<{ story_id: string; views: number }>) {
        totals.set(row.story_id, (totals.get(row.story_id) ?? 0) + row.views);
      }
      const orderedIds = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .filter((id) => !exclude.has(id))
        .slice(0, limit * 2);
      if (orderedIds.length) {
        // getStoriesByIds returns published stories only, unordered — re-rank.
        const byId = new Map((await getStoriesByIds(orderedIds)).map((s) => [s.id, s]));
        for (const id of orderedIds) {
          const s = byId.get(id);
          if (s) ranked.push(s);
          if (ranked.length >= limit) break;
        }
      }
    }
  } catch (e) {
    console.error('[getTrendingStories] view ranking failed', e);
  }

  // 2) Top up with the newest published site-wide (cold start / thin data).
  if (ranked.length < limit) {
    const seen = new Set([...exclude, ...ranked.map((s) => s.id)]);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stories')
      .select(LIST_COLUMNS)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit * 3);
    if (!error && data) {
      for (const s of data as unknown as StoryListItem[]) {
        if (seen.has(s.id)) continue;
        ranked.push(s);
        if (ranked.length >= limit) break;
      }
    }
  }

  return ranked.slice(0, limit);
}

/**
 * The "You Might Also" pool for a section page. Uses the section's own
 * leftover stories when there are enough; otherwise tops up with trending
 * (then newest) site-wide stories, excluding everything already shown.
 */
export async function getAlsoPool(
  remainder: StoryListItem[],
  shownIds: ReadonlySet<string>,
  minCount = 4,
  target = 14
): Promise<StoryListItem[]> {
  if (remainder.length >= minCount) return remainder;
  const exclude = new Set<string>([...shownIds, ...remainder.map((s) => s.id)]);
  const fill = await getTrendingStories(target - remainder.length, exclude);
  return [...remainder, ...fill];
}
