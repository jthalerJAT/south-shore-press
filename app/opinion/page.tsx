import type { Metadata } from 'next';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import {
  getPublishedStoriesBySection,
  getPublishedStoriesBySectionRange,
  getStoriesByIds,
} from '@/lib/queries/stories';
import { getAllPins, resolveSlotWithPinned } from '@/lib/queries/site-layout';
import { SITE } from '@/lib/site-config';
import { getSiteOrigin } from '@/lib/site-url';
import { SectionGrid } from '../[section]/section-grid';

// ISR — same 60s window as the other sections. Pin changes trigger an explicit
// revalidatePath('/opinion') from the Site Layout actions.
export const revalidate = 60;

// Stories shown per "page" in the main grid — initial load + each "Load More".
const PAGE_SIZE = 24;
const RAIL_COUNT = 10;

export const metadata: Metadata = {
  title: 'Opinion',
  description: `Latest Opinion coverage from ${SITE.name}.`,
  alternates: { canonical: `${getSiteOrigin()}/opinion` },
  openGraph: {
    title: `Opinion — ${SITE.name}`,
    description: `Latest Opinion coverage from ${SITE.name}.`,
    type: 'website',
    url: `${getSiteOrigin()}/opinion`,
  },
};

/**
 * /opinion — the generic section grid (with Load More) plus the right-hand
 * "Top Stories" rail the other custom sections have:
 *   LEFT (8/12)  — reverse-chron story grid + Load More.
 *   RIGHT (4/12) — "Top Stories" rail of 10: latest Opinion stories by
 *                  default, admin-pinnable via Site Layout slot
 *                  section.opinion.recent. May duplicate the grid (same
 *                  behavior as /sports and /local).
 */
export default async function OpinionPage() {
  const [pins, firstBatch, railPool] = await Promise.all([
    getAllPins(),
    getPublishedStoriesBySectionRange('opinion', 0, PAGE_SIZE + 1),
    getPublishedStoriesBySection('opinion', 50),
  ]);

  const initial = firstBatch.slice(0, PAGE_SIZE);
  const initialHasMore = firstBatch.length > PAGE_SIZE;

  // Pre-fetch pinned stories by id so pins survive even when older than the pool.
  const pinnedById = new Map(
    (await getStoriesByIds([...new Set(pins.map((p) => p.story_id))])).map((s) => [s.id, s])
  );
  const topStories = resolveSlotWithPinned(
    pins,
    'section.opinion.recent',
    pinnedById,
    railPool,
    RAIL_COUNT
  );

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
          Section
        </div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Opinion
        </h1>
      </header>

      {initial.length === 0 ? (
        <p className="text-zinc-500">No published stories in Opinion yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
          <div className="lg:col-span-8">
            <SectionGrid
              section="opinion"
              initial={initial}
              pageSize={PAGE_SIZE}
              initialHasMore={initialHasMore}
            />
          </div>
          <aside className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
            <TopStoriesRail stories={topStories} title="Top Stories" />
          </aside>
        </div>
      )}
    </div>
  );
}
