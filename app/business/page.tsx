import type { Metadata } from 'next';
import { StoryCard } from '@/components/story/story-card';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import {
  getPublishedStoriesBySection,
  getStoriesByIds,
} from '@/lib/queries/stories';
import { getAllPins, resolveSlotWithPinned } from '@/lib/queries/site-layout';
import { SITE } from '@/lib/site-config';
import { getSiteOrigin } from '@/lib/site-url';
import { AlsoSection } from '../local/also-section';
import { MoreStories } from './more-stories';

// ISR — same 60s window as the other sections. Pin changes trigger an explicit
// revalidatePath('/business') from the Site Layout actions.
export const revalidate = 60;

// 3 across × 4 down = the latest 12 published stories.
const MAIN_TILES = 12;
const RAIL_COUNT = 10;
const MORE_ROWS = 10; // initial "More Stories" rows before Show More
const ALSO_TILES = 4;

export const metadata: Metadata = {
  title: 'Business',
  description: `Latest Business coverage from ${SITE.name}.`,
  alternates: { canonical: `${getSiteOrigin()}/business` },
  openGraph: {
    title: `Business — ${SITE.name}`,
    description: `Latest Business coverage from ${SITE.name}.`,
    type: 'website',
    url: `${getSiteOrigin()}/business`,
  },
};

/**
 * /business — hybrid of the Opinion and Local layouts:
 *   LEFT (8/12)  — 3×4 grid = the latest 12 published, reverse-chron.
 *   RIGHT (4/12) — "Top Stories" rail of 10: latest by default, admin-pinnable
 *                  via Site Layout slot section.business.recent; may duplicate
 *                  the grid (same as /sports, /local, /opinion).
 *   Below        — "More Stories": rows of everything not shown above,
 *                  10 initially + "Show More Stories" (+10 each click).
 *   Bottom       — "You Might Also Be Interested In": 4 tiles.
 */
export default async function BusinessPage() {
  const [pins, pool] = await Promise.all([
    getAllPins(),
    // Pulled deep so More Stories + the Also tiles have plenty to draw from.
    getPublishedStoriesBySection('business', 120),
  ]);

  // Pre-fetch pinned stories by id so pins survive even when older than the pool.
  const pinnedById = new Map(
    (await getStoriesByIds([...new Set(pins.map((p) => p.story_id))])).map((s) => [s.id, s])
  );

  // Main 3×4 tiles — the latest 12, pure reverse-chron.
  const mainTiles = pool.slice(0, MAIN_TILES);

  // Right-rail Top Stories — latest by default (duplication with the tiles is
  // fine), or admin pins via section.business.recent.
  const topStories = resolveSlotWithPinned(
    pins,
    'section.business.recent',
    pinnedById,
    pool,
    RAIL_COUNT
  );

  // Everything not shown above, reverse-chron. The 4 "You Might Also" tiles are
  // carved out right after the first 10 rows so the expanding More Stories list
  // never duplicates them.
  const shownIds = new Set<string>();
  for (const s of mainTiles) shownIds.add(s.id);
  for (const s of topStories) shownIds.add(s.id);
  const remaining = pool.filter((s) => !shownIds.has(s.id));
  const alsoTiles = remaining.slice(MORE_ROWS, MORE_ROWS + ALSO_TILES);
  const moreRows = [...remaining.slice(0, MORE_ROWS), ...remaining.slice(MORE_ROWS + ALSO_TILES)];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="pb-4 mb-6 border-b border-zinc-200">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">Section</div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">
          Business
        </h1>
      </div>

      {/* Two columns: main tile grid (left) + Top Stories rail (right). */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
        <div className="lg:col-span-8">
          {mainTiles.length === 0 ? (
            <p className="text-zinc-500">No published Business stories yet. Check back soon.</p>
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

      {/* More Stories — everything else, 10 rows + Show More Stories. */}
      <MoreStories stories={moreRows} initialCount={MORE_ROWS} step={10} />

      {/* You Might Also Be Interested In — 4 tiles. */}
      <AlsoSection stories={alsoTiles} initialCount={ALSO_TILES} />
    </div>
  );
}
