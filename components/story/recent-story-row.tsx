import Link from 'next/link';
import { HeroMedia } from './hero-media';
import { buildStoryPath } from '@/lib/slugify';
import { sectionLabel } from '@/lib/site-config';
import type { StoryListItem } from '@/lib/queries/stories';

/**
 * Horizontal "recent story" row: thumbnail on the left, then section label,
 * headline, and blurb (subline) on the right. Used in the Sports + Local
 * "Recent Stories" lists below the main grids.
 */
export function RecentStoryRow({ story }: { story: StoryListItem }) {
  const href = buildStoryPath({
    id: story.id,
    headline: story.headline,
    categories: story.categories,
  });

  const formattedDate = story.published_at
    ? new Date(story.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const meta = [story.byline ? `By ${story.byline}` : null, formattedDate]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={href} className="group flex gap-4 sm:gap-5 py-4 border-b border-zinc-200 last:border-b-0">
      <div className="w-32 sm:w-52 shrink-0">
        <HeroMedia url={story.hero_photo_url} alt={story.headline} variant="card" />
      </div>
      <div className="min-w-0 flex-1">
        {story.categories?.[0] ? (
          <div className="text-[10px] uppercase tracking-widest text-brand-red font-bold">
            {sectionLabel(story.categories[0])}
          </div>
        ) : null}
        <h3 className="mt-1 font-headline text-base sm:text-xl font-bold leading-snug text-zinc-900 group-hover:text-brand-red transition-colors line-clamp-2">
          {story.headline}
        </h3>
        {story.subline ? (
          <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed line-clamp-2 hidden sm:block">
            {story.subline}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-2 text-[11px] text-zinc-500 font-medium">{meta}</div>
        ) : null}
      </div>
    </Link>
  );
}
