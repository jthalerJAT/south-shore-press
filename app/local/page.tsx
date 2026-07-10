import type { Metadata } from 'next';
import { StoryCard } from '@/components/story/story-card';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import { RecentStoryRow } from '@/components/story/recent-story-row';
import { getPublishedStoriesBySection, getStoriesByIds } from '@/lib/queries/stories';
import { getAllPins, resolveSlotWithPinned } from '@/lib/queries/site-layout';
import { getSiteOrigin } from '@/lib/site-url';
import { AlsoSection } from '@/components/story/also-section';
import { getAlsoPool } from '@/lib/queries/trending';

// ISR — same 60s window as the homepage / other sections. Publishing or pin
// changes trigger an explicit revalidatePath('/local').
export const revalidate = 60;

// 3 × 3 grid of main tiles = the latest 9 published stories.
const MAIN_TILES = 9;
const RAIL_COUNT = 10;

export const metadata: Metadata = {
  title: 'Local · The South Shore Press',
  description: 'Local news from across the South Shore and Suffolk County.',
  alternates: { canonical: `${getSiteOrigin()}/local` },
  openGraph: { title: 'Local', type: 'website', url: `${getSiteOrigin()}/local` },
};

/**
 * /local page — mirrors the /sports layout (minus sub-sections):
 *   LEFT (8/12)  — 3×3 grid = the latest 9 published (or admin-pinned via
 *                  Site Layout slot section.local.top).
 *   RIGHT (4/12) — "Top Stories" rail of 10, the latest stories; may duplicate
 *                  the tiles (same as /sports) unless pinned via
 *                  section.local.recent.
 *   Below        — "Recent Stories": reverse-chron of every other Local story
 *                  not in the tiles or the rail (10 rows).
 *   Bottom       — "You Might Also Be Interested In": 4 tiles + "Show More".
 */
export default async function LocalPage() {
  const [pins, pool] = await Promise.all([
    getAllPins(),
    // Pulled deep so Recent + "Show More" have plenty to draw from.
    getPublishedStoriesBySection('local', 120),
  ]);

  // Pre-fetch pinned stories by id so pins survive even when older than the pool.
  const pinnedById = new Map(
    (await getStoriesByIds([...new Set(pins.map((p) => p.story_id))])).map((s) => [s.id, s])
  );

  // Main 3×3 tiles FIRST — the latest 9 published (or admin pins via
  // section.local.top), drawn from the full pool so the newest stories are the
  // visible tiles.
  const mainTiles = resolveSlotWithPinned(pins, 'section.local.top', pinnedById, pool, MAIN_TILES);

  // Right-rail Top Stories — the latest stories from the full pool; duplication
  // with the tiles is allowed (same behavior as /sports) unless admin-pinned via
  // section.local.recent.
  const topStories = resolveSlotWithPinned(pins, 'section.local.recent', pinnedById, pool, RAIL_COUNT);

  // Recent Stories — reverse-chron of everything NOT already shown in the tiles
  // or the rail. First 10 → "Recent Stories", the rest → "You Might Also".
  const shownIds = new Set<string>();
  for (const s of mainTiles) shownIds.add(s.id);
  for (const s of topStories) shownIds.add(s.id);
  const remaining = pool.filter((s) => !shownIds.has(s.id));
  const recentStories = remaining.slice(0, 10);
  // Thin-section fallback: top up with trending / newest site-wide stories.
  const allShown = new Set<string>([...shownIds, ...recentStories.map((s) => s.id)]);
  const alsoPool = await getAlsoPool(remaining.slice(10), allShown);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="pb-4 mb-6 border-b border-zinc-200">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">Section</div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">Local</h1>
      </div>

      {/* Two columns: main tile grid (left) + Top Stories rail (right). */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
        <div className="lg:col-span-8">
          {mainTiles.length === 0 ? (
            <p className="text-zinc-500">No published Local stories yet. Check back soon.</p>
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

      {/* Recent Stories — everything else not shown above, reverse-chron. */}
      {recentStories.length > 0 ? (
        <section className="mt-12 pt-8 border-t-2 border-brand-red">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 mb-2">
            Recent Stories
          </h2>
          <div>
            {recentStories.map((story) => (
              <RecentStoryRow key={story.id} story={story} />
            ))}
          </div>
        </section>
      ) : null}

      {/* You Might Also Be Interested In — 4 tiles + Show More (+10). */}
      <AlsoSection stories={alsoPool} initialCount={4} step={10} />
    </div>
  );
}
