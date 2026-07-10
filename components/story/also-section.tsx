'use client';

import { useState } from 'react';
import { StoryCard } from '@/components/story/story-card';
import type { StoryListItem } from '@/lib/queries/stories';

/**
 * "You Might Also Be Interested In" — starts with 4 tiles, with a "Show More"
 * link that reveals another `step` (10) stories each click from the already-
 * fetched pool. Hides once everything is shown.
 */
export function AlsoSection({
  stories,
  initialCount = 4,
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
      <h2 className="font-headline text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 mb-6">
        You Might Also Be Interested In
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {shown.map((story) => (
          <StoryCard key={story.id} story={story} variant="standard" />
        ))}
      </div>
      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((c) => c + step)}
            className="inline-flex items-center px-6 py-3 text-sm font-semibold uppercase tracking-wide text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
          >
            Show More
          </button>
        </div>
      ) : null}
    </section>
  );
}
