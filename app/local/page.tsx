import type { Metadata } from 'next';
import { StoryCard } from '@/components/story/story-card';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import { RecentStoryRow } from '@/components/story/recent-story-row';
import { getPublishedStoriesBySection } from '@/lib/queries/stories';
import { getAllPins, resolveSlotStories } from '@/lib/queries/site-layout';
import { getSiteOrigin } from '@/lib/site-url';
import { AlsoSection } from './also-section';

// ISR — same 60s window as the homepage / other sections. Publishing or pin
// changes trigger an explicit revalidatePath('/local').
export const revalidate = 60;

// 5 rows × 3 = 15 main tiles.
const MAIN_TILES = 15;

export const metadata: Metadata = {
  title: 'Local · The South Shore Press',
  description: 'Local news from across the South Shore and Suffolk County.',
  alternates: { canonical: `${getSiteOrigin()}/local` },
  openGraph: { title: 'Local', type: 'website', url: `${getSiteOrigin()}/local` },
};

/**
 * /local page — mirrors the /sports layout (minus sub-sections):
 *   LEFT (8/12)  — 5×3 grid of main tiles (reverse-chron, or admin-pinned via
 *                  Site Layout slot section.local.top).
 *   RIGHT (4/12) — "Top Stories" rail of 10 (reverse-chron or pinned via
 *                  section.local.recent).
 *   Below        — "Recent Stories": reverse-chron of every other Local story
 *                  not already shown above (10 rows).
 *   Bottom       — "You Might Also Be Interested In": 4 tiles + "Show More".
 */
export default async function LocalPage() {
  const [pins, pool] = await Promise.all([
    getAllPins(),
    // Pulled deep so Recent + "Show More" have plenty to draw from.
    getPublishedStoriesBySection('local', 120),
  ]);

  // Right-rail Top Stories — reverse-chron or admin pins.
  const topStories = resolveSlotStories(
    pins.filter((p) => p.slot_key === 'section.local.recent'),
    pool,
    10
  );

  // Main 5×3 tiles — drawn from the pool MINUS the rail so the two don't
  // duplicate; reverse-chron or admin pins (section.local.top).
  const railIds = new Set(topStories.map((s) => s.id));
  const tilesPool = pool.filter((s) => !railIds.has(s.id));
  const mainTiles = resolveSlotStories(
    pins.filter((p) => p.slot_key === 'section.local.top'),
    tilesPool,
    MAIN_TILES
  );

  // Everything else, reverse-chron: first 10 → "Recent Stories", the rest →
  // the "You Might Also" / Show More pool.
  const shownIds = new Set<string>(railIds);
  for (const s of mainTiles) shownIds.add(s.id);
  const remaining = pool.filter((s) => !shownIds.has(s.id));
  const recentStories = remaining.slice(0, 10);
  const alsoPool = remaining.slice(10);

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
