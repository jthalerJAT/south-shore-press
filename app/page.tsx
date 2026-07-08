import { HeroCarousel } from '@/components/story/hero-carousel';
import { TopStoriesRail } from '@/components/story/top-stories-rail';
import { SectionRail } from '@/components/story/section-rail';
import {
  getLatestPublishedStories,
  getPublishedStoriesBySection,
  getStoriesByIds,
} from '@/lib/queries/stories';
import { getAllPins, resolveSlotWithPinned } from '@/lib/queries/site-layout';
import { SITE_SECTIONS } from '@/lib/site-config';

// ISR — Vercel rebuilds the page at most once a minute, then serves
// everything from the edge cache. That's how we'll absorb traffic
// spikes without pounding Supabase.
export const revalidate = 60;

// Per-section rails below the hero block, in display order.
// Video Vault now sits first per editor request (was at the bottom).
const HOMEPAGE_SECTION_SLUGS = [
  'video-vault',
  'local',
  'sports',
  'state',
  'national',
  'opinion',
  'business',
];

export default async function HomePage() {
  // Parallel fan-out: site-layout pin map + a broad pool of latest
  // stories + 20 latest per homepage section. We fetch broader pools
  // than we need so editor pins (which can reference older stories)
  // are usually included; pins outside the pool silently fall back to
  // recency. Pre-fetching by id is an MVP follow-up.
  const [pins, latest, sectionFallbacks] = await Promise.all([
    getAllPins(),
    getLatestPublishedStories(50),
    Promise.all(
      HOMEPAGE_SECTION_SLUGS.map(async (slug) => {
        const stories = await getPublishedStoriesBySection(slug, 20);
        const section = SITE_SECTIONS.find((s) => s.slug === slug);
        return { slug, title: section?.label ?? slug, stories };
      })
    ),
  ]);

  // Pre-fetch every pinned story by id so pins are honored even when the pinned
  // story is older than the recency pools (the cause of a recent article
  // leaking into a fully-pinned hero).
  const pinnedById = new Map(
    (await getStoriesByIds([...new Set(pins.map((p) => p.story_id))])).map((s) => [s.id, s])
  );

  // Hero: 5 stories, pinned + recency-fill.
  const heroStories = resolveSlotWithPinned(pins, 'home.hero', pinnedById, latest, 5);

  // Top Stories rail: 10 stories. PREFER non-hero stories so editors
  // don't see the same headlines twice — but top up with the hero set
  // when the published pool is small enough that strictly excluding
  // them would leave the rail mostly empty. Pins always win.
  const heroIds = new Set(heroStories.map((s) => s.id));
  const nonHero = latest.filter((s) => !heroIds.has(s.id));
  const heroForBackfill = latest.filter((s) => heroIds.has(s.id));
  const topStories = resolveSlotWithPinned(
    pins,
    'home.top-stories',
    pinnedById,
    [...nonHero, ...heroForBackfill],
    10
  );

  // Per-section rails. Slot key is `home.<slug>`, e.g. home.local.
  const sectionRails = sectionFallbacks.map(({ slug, title, stories }) => ({
    slug,
    title,
    stories: resolveSlotWithPinned(pins, `home.${slug}`, pinnedById, stories, 4),
  }));

  // Empty-state — keeps the "rebuilding" message visible while the
  // DB hasn't published anything yet. Disappears the moment the
  // first story goes live.
  if (heroStories.length === 0) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">
          The South Shore Press
        </div>
        <h1 className="mt-3 font-headline text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900">
          New stories are on the way.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed">
          Our newsroom is publishing fresh coverage of the South Shore and
          Suffolk County. Check back shortly.
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

      {/* SECTION RAILS — full-width, stacked below. Video Vault first.
          Video Vault renders even when empty so its slot in the order
          is preserved; other sections collapse out of the layout when
          they have no published content. */}
      {sectionRails.map((rail) => (
        <SectionRail
          key={rail.slug}
          title={rail.title}
          sectionSlug={rail.slug}
          stories={rail.stories}
          showWhenEmpty={rail.slug === 'video-vault'}
        />
      ))}
    </div>
  );
}
