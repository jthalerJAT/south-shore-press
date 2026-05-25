import { HeroCarousel } from '@/components/story/hero-carousel';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import { SectionRail } from '@/components/story/section-rail';
import {
  getLatestPublishedStories,
  getPublishedStoriesBySection,
  getTopStories,
} from '@/lib/queries/stories';
import { SITE_SECTIONS } from '@/lib/site-config';

// ISR — Vercel rebuilds the page at most once a minute, then serves
// everything from the edge cache. That's how we'll absorb traffic
// spikes without pounding Supabase.
export const revalidate = 60;

// Per-section rails below the hero block, in display order.
const HOMEPAGE_SECTION_SLUGS = [
  'local',
  'sports',
  'state',
  'national',
  'opinion',
  'crime',
];

export default async function HomePage() {
  // Fan-out parallel queries: 5 hero stories, 10 top-stories
  // (offset 5 so they don't duplicate the hero set), plus 4 cards
  // for each section rail. Promise.all keeps the homepage waterfall
  // flat — total DB time = max() of all queries, not sum().
  const [heroStories, topStories, sectionRails] = await Promise.all([
    getLatestPublishedStories(5),
    getTopStories(5, 10),
    Promise.all(
      HOMEPAGE_SECTION_SLUGS.map(async (slug) => {
        const stories = await getPublishedStoriesBySection(slug, 4);
        const section = SITE_SECTIONS.find((s) => s.slug === slug);
        return { slug, title: section?.label ?? slug, stories };
      })
    ),
  ]);

  // Empty-state — keeps the "rebuilding" message visible while the
  // DB hasn't published anything yet. Disappears the moment the
  // first story goes live.
  if (heroStories.length === 0) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">
          v2 — under construction
        </div>
        <h1 className="mt-3 font-headline text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900">
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

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/*
        HERO + TOP STORIES BLOCK
        ------------------------
        Two-column grid at lg+. The hero owns the row height via
        aspect-video on its image area; the Top Stories rail uses an
        absolute child pinned to the row so it always matches the
        hero's height regardless of how many stories are in it
        (the inner <ul> handles its own scroll). Below lg both stack.
      */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-stretch">
        <div className="lg:col-span-8">
          <HeroCarousel stories={heroStories} />
        </div>
        <div className="lg:col-span-4 lg:relative lg:min-h-0">
          <div className="lg:absolute lg:inset-0">
            <TopStoriesRail stories={topStories} />
          </div>
        </div>
      </section>

      {/* SECTION RAILS — full-width, stacked below */}
      {sectionRails.map((rail) => (
        <SectionRail
          key={rail.slug}
          title={rail.title}
          sectionSlug={rail.slug}
          stories={rail.stories}
        />
      ))}
    </div>
  );
}
