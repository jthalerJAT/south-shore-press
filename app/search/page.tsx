import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { searchPublishedStories } from '@/lib/queries/stories';
import { RecentStoryRow } from '@/components/story/recent-story-row';

export const metadata: Metadata = {
  title: 'Search',
  // Search-result pages shouldn't be indexed (thin/duplicative for crawlers).
  robots: { index: false, follow: false },
};

// Results depend on ?q= and read live data.
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  const results = q ? await searchPublishedStories(q, 50) : [];

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">Search</h1>

      {/* Search box (pre-filled) so readers can refine without going back. */}
      <form action="/search" method="GET" className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search articles…"
            className="block w-full rounded border border-zinc-300 pl-9 pr-3 py-2.5 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {!q ? (
          <p className="text-zinc-500">Type a word or phrase above to search every published article.</p>
        ) : results.length === 0 ? (
          <p className="text-zinc-600">
            No articles found for{' '}
            <span className="font-medium text-zinc-900">&ldquo;{q}&rdquo;</span>. Try different or fewer words.
          </p>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-2">
              {results.length} result{results.length === 1 ? '' : 's'} for{' '}
              <span className="font-medium text-zinc-900">&ldquo;{q}&rdquo;</span>
            </p>
            <div>
              {results.map((story) => (
                <RecentStoryRow key={story.id} story={story} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
