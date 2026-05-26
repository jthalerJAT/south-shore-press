'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StoryCard } from '@/components/story/story-card';
import type { StoryListItem } from '@/lib/queries/stories';

/**
 * Collapsible sub-section block used on the /sports page for each of
 * Local Sports / Pro Sports / Fantasy Sports.
 *
 * Default view: a 2x2 grid (up to 4 stories).
 * Expanded view: a wider grid with every story in the section.
 * "View All" link toggles between the two states — same control
 * collapses back to the 2x2 when expanded.
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
  const hasOverflow = stories.length > 4;
  const shown = expanded ? stories : stories.slice(0, 4);

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-baseline justify-between gap-4 pb-3 mb-5 border-b border-zinc-200">
        <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-zinc-900">
          {title}
        </h2>
        <div className="flex items-center gap-4">
          {hasOverflow ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] uppercase tracking-widest font-bold text-brand-red hover:text-brand-red-dark transition-colors whitespace-nowrap"
            >
              {expanded ? '← Collapse' : 'View All →'}
            </button>
          ) : null}
          <Link
            href={`/sports#${sectionSlug}`}
            className="hidden sm:inline text-[11px] uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-800 transition-colors whitespace-nowrap"
            id={sectionSlug}
            aria-hidden="true"
          >
            {/* anchor target only */}
          </Link>
        </div>
      </div>

      {stories.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-500">
          Stories coming soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {shown.map((story) => (
            <StoryCard key={story.id} story={story} variant="standard" />
          ))}
        </div>
      )}
    </section>
  );
}
