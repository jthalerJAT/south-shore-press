'use client';

import { useState } from 'react';
import { StoryCard } from '@/components/story/story-card';
import type { StoryListItem } from '@/lib/queries/stories';
import { loadMoreSection } from './actions';

/**
 * Section story grid with a "Load More" button. Renders the initial server-
 * fetched batch, then appends the next page on click via a server action.
 * Dedupes by id so a story published mid-browse can't double up.
 */
export function SectionGrid({
  section,
  initial,
  pageSize,
  initialHasMore,
}: {
  section: string;
  initial: StoryListItem[];
  pageSize: number;
  initialHasMore: boolean;
}) {
  const [stories, setStories] = useState<StoryListItem[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const next = await loadMoreSection(section, stories.length, pageSize);
      setStories((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...next.filter((s) => !seen.has(s.id))];
      });
      if (next.length < pageSize) setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} variant="standard" />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {loading ? 'Loading…' : 'Load More Stories'}
          </button>
        </div>
      ) : null}
    </>
  );
}
