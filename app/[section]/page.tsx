import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublishedStoriesBySectionRange } from '@/lib/queries/stories';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';
import { SectionGrid } from './section-grid';

// ISR — same 60s revalidate as homepage for now; Phase 4 will tune.
export const revalidate = 60;

// Stories shown per "page" — initial load + each "Load More" click.
const PAGE_SIZE = 24;

type Params = { section: string };

// Pre-render every known section at build time. Anything else 404s — we
// don't accept arbitrary user-supplied sections (would let SEO spam slip
// in via random URLs).
export function generateStaticParams(): Params[] {
  // Sections with their own literal routes (which take precedence) are
  // excluded so we don't statically render the same path twice.
  const LITERAL_ROUTES = new Set(['legals', 'opinion', 'business']);
  return SITE_SECTIONS.filter((s) => !LITERAL_ROUTES.has(s.slug)).map((s) => ({
    section: s.slug,
  }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const section = SITE_SECTIONS.find((s) => s.slug === params.section);
  if (!section) return {};
  return {
    title: section.label,
    description: `Latest ${section.label} coverage from ${SITE.name}.`,
    alternates: { canonical: `/${section.slug}` },
    openGraph: {
      title: `${section.label} — ${SITE.name}`,
      description: `Latest ${section.label} coverage from ${SITE.name}.`,
      type: 'website',
    },
  };
}

export default async function SectionIndexPage({
  params,
}: {
  params: Params;
}) {
  const section = SITE_SECTIONS.find((s) => s.slug === params.section);
  if (!section) notFound();

  // Fetch the first page (+1 so we know whether a "Load More" button is needed
  // without a separate count query).
  const firstBatch = await getPublishedStoriesBySectionRange(section.slug, 0, PAGE_SIZE + 1);
  const initial = firstBatch.slice(0, PAGE_SIZE);
  const initialHasMore = firstBatch.length > PAGE_SIZE;

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="border-b-2 border-brand-red pb-3 mb-8">
        <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
          Section
        </div>
        <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          {section.label}
        </h1>
      </header>

      {initial.length === 0 ? (
        <p className="text-zinc-500">
          No published stories in {section.label} yet. Check back soon.
        </p>
      ) : (
        <SectionGrid
          section={section.slug}
          initial={initial}
          pageSize={PAGE_SIZE}
          initialHasMore={initialHasMore}
        />
      )}
    </div>
  );
}
