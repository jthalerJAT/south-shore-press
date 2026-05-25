import Link from 'next/link';
import { StoryCard } from '@/components/story/story-card';
import { SectionRail } from '@/components/story/section-rail';
import {
  getLatestPublishedStories,
  getPublishedStoriesBySection,
} from '@/lib/queries/stories';
import { SITE_SECTIONS } from '@/lib/site-config';

// Server-rendered Homepage. Pulls:
//   - The 13 most-recent published stories overall (1 hero + 4 secondary +
//     8 "Latest" rail), then
//   - For each top-priority section, the latest 4 in that section.
//
// `revalidate = 60` triggers ISR — Vercel rebuilds the page at most once a
// minute. Reads served from the edge cache after that, which is how we'll
// scale to 1M views/day without melting Supabase. Phase 4 will tune this
// per section if needed.
export const revalidate = 60;

// Sections that get rails on the homepage, in order of prominence.
// Anything in SITE_SECTIONS not listed here is reachable via header nav
// + footer + category index pages.
const HOMEPAGE_SECTION_SLUGS = [
  'local',
  'sports',
  'state',
  'national',
  'opinion',
  'crime',
];

export default async function HomePage() {
  // Fetch latest cross-section first; then in parallel pull each section's
  // top stories. Promise.all keeps the homepage waterfall flat.
  const latest = await getLatestPublishedStories(13);

  const railsData = await Promise.all(
    HOMEPAGE_SECTION_SLUGS.map(async (slug) => {
      const stories = await getPublishedStoriesBySection(slug, 4);
      const section = SITE_SECTIONS.find((s) => s.slug === slug);
      return { slug, title: section?.label ?? slug, stories };
    })
  );

  // Empty-state — keeps the "rebuilding" message visible while there are
  // no published stories on v2 yet. Drops out as soon as the editor
  // publishes the first one.
  if (latest.length === 0) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
        <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
          v2 — under construction
        </div>
        <h1 className="mt-3 font-headline text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
          We&apos;re rebuilding for speed, search, and scale.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed">
          A modern, server-rendered, mobile-first stack so search engines,
          social previews, and ad platforms work the way a real news site
          needs them to.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          The current site stays live during the rebuild at{' '}
          <a
            href="https://southshorepress.vercel.app"
            className="text-brand-red hover:underline font-medium"
          >
            southshorepress.vercel.app
          </a>
          .
        </p>
      </section>
    );
  }

  const [hero, ...rest] = latest;
  const secondary = rest.slice(0, 4);
  const latestRail = rest.slice(4);

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Top: 1 hero (8 cols) + 4 secondary (4 cols, stacked) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <StoryCard story={hero} variant="feature" />
        </div>
        {secondary.length > 0 ? (
          <aside className="lg:col-span-4 flex flex-col gap-6 lg:border-l lg:border-zinc-200 lg:pl-8">
            {secondary.map((s) => (
              <StoryCard key={s.id} story={s} variant="standard" />
            ))}
          </aside>
        ) : null}
      </section>

      {/* Latest rail — cross-section, chronological */}
      {latestRail.length > 0 ? (
        <SectionRail
          title="Latest"
          sectionSlug={HOMEPAGE_SECTION_SLUGS[0]}
          stories={latestRail}
        />
      ) : null}

      {/* Per-section rails */}
      {railsData.map((rail) => (
        <SectionRail
          key={rail.slug}
          title={rail.title}
          sectionSlug={rail.slug}
          stories={rail.stories}
        />
      ))}

      <div className="mt-16 text-center">
        <Link
          href="/local"
          className="inline-block text-sm uppercase tracking-widest font-semibold text-brand-red hover:text-brand-red-dark transition-colors"
        >
          Browse all sections →
        </Link>
      </div>
    </div>
  );
}
