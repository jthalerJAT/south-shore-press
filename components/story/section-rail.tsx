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

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between border-b-2 border-brand-red pb-2 mb-6">
        <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-zinc-900">
          {title}
        </h2>
        <Link
          href={`/${sectionSlug}`}
          className="text-xs uppercase tracking-widest font-semibold text-brand-red hover:text-brand-red-dark transition-colors"
        >
          More {title} →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stories.slice(0, 4).map((story) => (
          <StoryCard key={story.id} story={story} variant="standard" />
        ))}
      </div>
    </section>
  );
}
