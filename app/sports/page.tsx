import type { Metadata } from 'next';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import {
  getPublishedStoriesBySection,
} from '@/lib/queries/stories';
import { getAllPins, resolveSlotStories } from '@/lib/queries/site-layout';
import { SPORTS_SUBCATEGORIES } from '@/lib/site-config';
import { getSiteOrigin } from '@/lib/site-url';
import { SportsSubsection } from './sports-subsection';

// ISR — same 60s window as the homepage. Publishing or pin changes
// trigger an explicit revalidatePath('/sports') in their actions.
export const revalidate = 60;

const SUB_SLUGS = SPORTS_SUBCATEGORIES.map((s) => s.slug);

export const metadata: Metadata = {
  title: 'Sports · The South Shore Press',
  description:
    'Local, pro, and fantasy sports coverage from the South Shore and beyond.',
  alternates: { canonical: `${getSiteOrigin()}/sports` },
  openGraph: {
    title: 'Sports',
    type: 'website',
    url: `${getSiteOrigin()}/sports`,
  },
};

/**
 * /sports page. Custom layout overriding the generic /[section] handler.
 *
 * Two-column at lg+:
 *   LEFT (8/12)  — three stacked sub-sections (Local / Pro / Fantasy
 *                  Sports), each defaulting to a 2x2 grid with a
 *                  "View All" toggle to expand inline.
 *   RIGHT (4/12) — Recent Stories rail (10 stories from any sports
 *                  tag, reverse-chronological with editor pin overrides
 *                  via the Site Layout pin slot section.sports.recent).
 *
 * Sub-sections also support pin overrides via
 * section.sports.<sub-slug> (4 slots each).
 */
export default async function SportsPage() {
  // Parallel fan-out: pins (whole table) + the parent sports pool +
  // each sub-section's published list. We cap each pool well above
  // its render limit so pinned older stories are still in the set
  // and don't silently fall back to recency.
  const [pins, recent, subStories] = await Promise.all([
    getAllPins(),
    // 'sports' tag catches everything — sub-cat stories are auto-tagged
    // with 'sports' in the save action, and legacy sports-only stories
    // still match this.
    getPublishedStoriesBySection('sports', 60),
    Promise.all(
      SPORTS_SUBCATEGORIES.map(async (sub) => ({
        slug: sub.slug,
        title: sub.label,
        stories: await getPublishedStoriesBySection(sub.slug, 50),
      }))
    ),
  ]);

  const recentStories = resolveSlotStories(
    pins.filter((p) => p.slot_key === 'section.sports.recent'),
    recent,
    10
  );

  const subSectionsResolved = subStories.map(({ slug, title, stories }) => ({
    slug,
    title,
    stories: resolveSlotStories(
      pins.filter((p) => p.slot_key === `section.sports.${slug}`),
      stories,
      // We pass the full pool here (not 4) so the "View All" expansion
      // has all stories to show. Pin resolution still places pinned
      // stories in the first N positions; the rest are reverse-chron.
      Math.max(stories.length, 4)
    ),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="pb-4 mb-6 border-b border-zinc-200">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">
          Section
        </div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">
          Sports
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
        {/* LEFT — 3 sub-sections stacked */}
        <div className="lg:col-span-8 space-y-2">
          {subSectionsResolved.map((sub) => (
            <SportsSubsection
              key={sub.slug}
              title={sub.title}
              sectionSlug={sub.slug}
              stories={sub.stories}
            />
          ))}
        </div>

        {/* RIGHT — recent-stories rail (sticky on lg+) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <TopStoriesRail stories={recentStories} title="Recent Stories" />
        </aside>
      </div>
    </div>
  );
}

// Suppress an unused warning if SUB_SLUGS gets pruned in a future refactor.
void SUB_SLUGS;
