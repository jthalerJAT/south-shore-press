import Link from 'next/link';
import { Star } from 'lucide-react';
import { buildStoryPath } from '@/lib/slugify';
import { SITE_SECTIONS } from '@/lib/site-config';
import type { StoryListItem } from '@/lib/queries/stories';

/**
 * Right-rail "Top Stories" list. Headlines only — no thumbnails (the
 * hero already carries the imagery). The container is set to `h-full`
 * + `min-h-0`; on the homepage we drop this inside an
 * absolutely-positioned wrapper so it matches the hero's height and
 * scrolls internally instead of pushing the layout.
 *
 * For now the input is just `getTopStories(offset=5, limit=10)` (the
 * next 10 most-recent published stories after the hero set). When
 * we wire view counts or an editor-pinned flag, the query swap
 * happens upstream and this component doesn't change.
 */
export function TopStoriesRail({ stories }: { stories: StoryListItem[] }) {
  if (stories.length === 0) return null;

  return (
    <aside className="h-full min-h-0 flex flex-col bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Sticky-ish title bar */}
      <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 shrink-0">
        <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-900 flex items-center gap-1.5">
          <Star
            className="w-3.5 h-3.5 text-brand-red fill-brand-red"
            aria-hidden="true"
          />
          Top Stories
        </h2>
      </div>

      <ul className="flex-1 min-h-0 lg:overflow-y-auto divide-y divide-zinc-100">
        {stories.map((story) => {
          const sectionSlug = story.categories?.[0] ?? null;
          const sectionLabel = sectionSlug
            ? SITE_SECTIONS.find((s) => s.slug === sectionSlug)?.label ??
              sectionSlug
            : null;
          const formattedDate = story.published_at
            ? new Date(story.published_at)
                .toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                .toUpperCase()
            : null;
          const href = buildStoryPath({
            id: story.id,
            headline: story.headline,
            categories: story.categories,
          });

          return (
            <li key={story.id}>
              <Link
                href={href}
                className="block px-4 py-3 hover:bg-zinc-50 transition-colors group"
              >
                {sectionLabel || formattedDate ? (
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                    {sectionLabel}
                    {sectionLabel && formattedDate ? (
                      <span aria-hidden="true"> · </span>
                    ) : null}
                    {formattedDate}
                  </div>
                ) : null}
                <h3 className="mt-1 font-headline text-[15px] font-bold leading-snug text-zinc-900 group-hover:text-brand-red transition-colors">
                  {story.headline}
                </h3>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
