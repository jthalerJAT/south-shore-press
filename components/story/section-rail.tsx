import Link from 'next/link';
import { StoryCard } from './story-card';
import type { StoryListItem } from '@/lib/queries/stories';

type Props = {
  title: string;
  sectionSlug: string;
  stories: StoryListItem[];
};

/**
 * A titled rail of story cards. Used on the homepage to show "Local",
 * "Sports", etc. Each rail renders up to 4 cards in a responsive grid.
 */
export function SectionRail({ title, sectionSlug, stories }: Props) {
  if (stories.length === 0) return null;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {stories.slice(0, 4).map((story) => (
          <StoryCard key={story.id} story={story} variant="standard" />
        ))}
      </div>
    </section>
  );
}
