import { StoryCard } from '@/components/story/story-card';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import { MoreStoriesSection } from '@/components/story/more-stories-section';
import { AlsoSection } from '@/components/story/also-section';
import { getPublishedStoriesBySection, getStoriesByIds } from '@/lib/queries/stories';
import { getAllPins, resolveSlotWithPinned } from '@/lib/queries/site-layout';
import { getTrendingStories } from '@/lib/queries/trending';

/**
 * Shared section-page layout — the /local format, reused by /local, /state,
 * /national and /world so the four match exactly:
 *   LEFT (8/12)  — 3×3 grid = latest 9 published (or admin-pinned via the Site
 *                  Layout slot `section.<slug>.top`).
 *   RIGHT (4/12) — "Top Stories" rail of 10 (reverse-chron default; admin
 *                  override via `section.<slug>.recent`).
 *   Below        — "More Stories": reverse-chron of everything else in-section,
 *                  10 rows + "Show More Stories".
 *   Bottom       — "You Might Also Be Interested In": the 4 most-clicked stories
 *                  site-wide (+ Show More), excluding this section's stories.
 */
const MAIN_TILES = 9;
const RAIL_COUNT = 10;
const MORE_MAX = 50;
const ALSO_POOL = 14;

export async function SectionFeed({ slug, label }: { slug: string; label: string }) {
  const [pins, pool] = await Promise.all([
    getAllPins(),
    // Pulled deep so More Stories has plenty to draw from.
    getPublishedStoriesBySection(slug, 120),
  ]);

  // Pre-fetch pinned stories by id so pins survive even when older than the pool.
  const pinnedById = new Map(
    (await getStoriesByIds([...new Set(pins.map((p) => p.story_id))])).map((s) => [s.id, s])
  );

  const mainTiles = resolveSlotWithPinned(pins, `section.${slug}.top`, pinnedById, pool, MAIN_TILES);
  const topStories = resolveSlotWithPinned(pins, `section.${slug}.recent`, pinnedById, pool, RAIL_COUNT);

  // More Stories — reverse-chron of everything in-section not already shown.
  const shownIds = new Set<string>();
  for (const s of mainTiles) shownIds.add(s.id);
  for (const s of topStories) shownIds.add(s.id);
  const moreStories = pool.filter((s) => !shownIds.has(s.id)).slice(0, MORE_MAX);

  // "You Might Also" — the most-clicked stories site-wide (trending, then newest
  // as a cold-start fallback), excluding everything in this section's pool so it
  // never repeats on-page content.
  const alsoStories = await getTrendingStories(ALSO_POOL, new Set(pool.map((s) => s.id)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="pb-4 mb-6 border-b border-zinc-200">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">Section</div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">{label}</h1>
      </div>

      {/* Main tile grid (left) + Top Stories rail (right). */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
        <div className="lg:col-span-8">
          {mainTiles.length === 0 ? (
            <p className="text-zinc-500">No published {label} stories yet. Check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {mainTiles.map((story) => (
                <StoryCard key={story.id} story={story} variant="standard" />
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <TopStoriesRail stories={topStories} title="Top Stories" />
        </aside>
      </div>

      <MoreStoriesSection stories={moreStories} />

      <AlsoSection stories={alsoStories} initialCount={4} step={10} />
    </div>
  );
}
