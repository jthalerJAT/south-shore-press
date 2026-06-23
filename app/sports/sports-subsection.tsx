'use client';

import { useState } from 'react';
import { StoryCard } from '@/components/story/story-card';
import type { StoryListItem } from '@/lib/queries/stories';

/**
 * Collapsible sub-section block used on the /sports page for each of
 * Local Sports / Pro Sports / Fantasy Sports.
 *
 * Default view: a 3-across × 2-row grid (up to 6 stories).
 * Expanded view: the same grid with every story in the section (up to the
 * 50-story fetch cap). "View All" toggles between the two states — same
 * control collapses back to 6 when expanded.
 *
 * Empty state: a dashed "Stories coming soon" placeholder so the
 * section heading is still visible to readers + editors.
 */
export function SportsSubsection({
  title,
  sectionSlug,
  stories,
}: {
  title: string;
  sectionSlug: string;
  stories: StoryListItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = stories.length > 6;
  const shown = expanded ? stories : stories.slice(0, 6);

  return (
    <section className="mt-8 first:mt-0">
      {/* The section heading wraps the anchor id so deep links like
          /sports#pro-sports scroll here. The Link removed — anchor
          targets just need an element with the id. */}
      <div
        id={sectionSlug}
        className="flex items-baseline justify-between gap-4 pb-3 mb-5 border-b border-zinc-200 scroll-mt-20"
      >
        <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-zinc-900">
          {title}
        </h2>
        {hasOverflow ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] uppercase tracking-widest font-bold text-brand-red hover:text-brand-red-dark transition-colors whitespace-nowrap"
          >
            {expanded ? '← Collapse' : 'View All →'}
          </button>
        ) : null}
      </div>

      {stories.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-500">
          Stories coming soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((story) => (
            <StoryCard key={story.id} story={story} variant="standard" />
          ))}
        </div>
      )}
    </section>
  );
}
