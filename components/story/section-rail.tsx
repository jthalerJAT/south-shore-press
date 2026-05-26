import Link from 'next/link';
import { StoryCard } from './story-card';
import type { StoryListItem } from '@/lib/queries/stories';

type Props = {
  title: string;
  sectionSlug: string;
  stories: StoryListItem[];
  /** When true, render the section header + a "Coming soon" placeholder
   *  even if stories[] is empty. Used for the lead section (Video Vault)
   *  so its slot in the page order is always visible to readers. */
  showWhenEmpty?: boolean;
};

/**
 * A titled rail of story cards. Used on the homepage to show "Local",
 * "Sports", etc. Each rail renders up to 4 cards in a responsive grid.
 */
export function SectionRail({ title, sectionSlug, stories, showWhenEmpty = false }: Props) {
  if (stories.length === 0 && !showWhenEmpty) return null;

  // v1 section-block treatment: bold serif title on the left, red
  // "View All →" link on the right, thin zinc divider line below
  // the row spanning the section's full width.
  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex items-baseline justify-between gap-4 pb-3 mb-5 sm:mb-6 border-b border-zinc-200">
        <h2 className="font-headline text-2xl sm:text-[26px] font-extrabold text-zinc-900">
          {title}
        </h2>
        <Link
          href={`/${sectionSlug}`}
          className="text-[11px] uppercase tracking-widest font-bold text-brand-red hover:text-brand-red-dark transition-colors whitespace-nowrap"
        >
          View All →
        </Link>
      </div>
      {/* `items-stretch` (CSS Grid default) makes all tiles in a row
          the same height, which lets StoryCard push its byline row
          to the bottom of every card uniformly via mt-auto. */}
      {stories.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
          Stories coming soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {stories.slice(0, 4).map((story) => (
            <StoryCard key={story.id} story={story} variant="standard" />
          ))}
        </div>
      )}
    </section>
  );
}
