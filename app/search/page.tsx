import type { Metadata } from 'next';

// Placeholder so the header search form doesn't 404. Real search lands
// in a later phase — either Postgres FTS over Supabase or a hosted
// indexer (Algolia / Meilisearch) depending on traffic shape.

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: false },
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? '').trim();

  return (
    <section className="max-w-xl mx-auto px-6 py-16 sm:py-24 text-center">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900">
        Search
      </h1>
      {q ? (
        <p className="mt-4 text-zinc-600 leading-relaxed">
          You searched for{' '}
          <span className="font-medium text-zinc-900">&ldquo;{q}&rdquo;</span>.
        </p>
      ) : null}
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Site search is coming in a later phase. In the meantime, browse by
        section from the navigation above.
      </p>
    </section>
  );
}
