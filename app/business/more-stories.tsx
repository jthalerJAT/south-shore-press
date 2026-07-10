'use client';

import { useState } from 'react';
import { RecentStoryRow } from '@/components/story/recent-story-row';
import type { StoryListItem } from '@/lib/queries/stories';

/**
 * "More Stories" — horizontal rows (thumbnail left, headline/blurb/date right),
 * 10 shown initially, "Show More Stories" reveals another `step` per click from
 * the already-fetched pool. Hides the button once everything is shown.
 */
export function MoreStories({
  stories,
  initialCount = 10,
  step = 10,
}: {
  stories: StoryListItem[];
  initialCount?: number;
  step?: number;
}) {
  const [count, setCount] = useState(initialCount);
  if (stories.length === 0) return null;

  const shown = stories.slice(0, count);
  const hasMore = count < stories.length;

  return (
    <section className="mt-12 pt-8 border-t-2 border-brand-red">
      <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 mb-2">
        More Stories
      </h2>
      <div>
        {shown.map((story) => (
          <RecentStoryRow key={story.id} story={story} />
        ))}
      </div>
      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((c) => c + step)}
            className="inline-flex items-center px-6 py-3 text-sm font-semibold uppercase tracking-wide text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
          >
            Show More Stories
          </button>
        </div>
      ) : null}
    </section>
  );
}
