import { createClient } from '@/lib/supabase/server';

/**
 * Lightweight metadata-only queries used by sitemaps and indexability
 * tooling. Pulled into a separate module so the heavy story rendering
 * code in lib/queries/stories.ts doesn't get loaded by routes that only
 * need URLs + timestamps.
 */

export type StorySitemapEntry = {
  id: string;
  headline: string;
  categories: string[] | null;
  published_at: string;
  hero_photo_url: string | null;
};

/**
 * Every published story, ordered by publish date (newest first). Used
 * by the main sitemap. Capped at 5,000 — Google's per-sitemap limit is
 * 50k URLs but most editors stop crawling sitemaps long before that, so
 * keeping our list focused on recent + relevant is a defensible trade.
 * If we grow past this, we'll paginate into multiple sitemaps.
 */
export async function getAllPublishedStoriesForSitemap(): Promise<
  StorySitemapEntry[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select('id, headline, categories, published_at, hero_photo_url')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(5000);
  if (error) {
    console.error('[getAllPublishedStoriesForSitemap]', error);
    return [];
  }
  // Filter out the null published_at edge case the type system can't
  // promise even after the .not() call above.
  return (data ?? []).filter(
    (r): r is StorySitemapEntry => typeof r.published_at === 'string'
  );
}

/**
 * Stories published in the last 48 hours. Google News specifically asks
 * for this window in news-sitemap.xml — anything older is ignored by the
 * News index, so including it just wastes the budget.
 */
export async function getRecentStoriesForNewsSitemap(): Promise<
  StorySitemapEntry[]
> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select('id, headline, categories, published_at, hero_photo_url')
    .eq('status', 'published')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('[getRecentStoriesForNewsSitemap]', error);
    return [];
  }
  return (data ?? []).filter(
    (r): r is StorySitemapEntry => typeof r.published_at === 'string'
  );
}
