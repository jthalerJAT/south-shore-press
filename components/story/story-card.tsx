import Link from 'next/link';
import { HeroMedia } from './hero-media';
import { buildStoryPath } from '@/lib/slugify';
import type { StoryListItem } from '@/lib/queries/stories';

type Props = {
  story: StoryListItem;
  /** 'feature' = larger hero card on top of grids; 'standard' = grid cell. */
  variant?: 'feature' | 'standard';
};

/**
 * Reusable story preview card. Used by:
 *   - Homepage hero (variant='feature')
 *   - Section grids on homepage
 *   - Category index pages
 *
 * The whole card is wrapped in <Link> so the entire surface is clickable
 * (mobile-friendly), but headline and hero image inherit anchor styling
 * via CSS so screen readers still announce one link.
 */
export function StoryCard({ story, variant = 'standard' }: Props) {
  const href = buildStoryPath({
    id: story.id,
    headline: story.headline,
    categories: story.categories,
  });

  if (variant === 'feature') {
    return (
      <Link href={href} className="group block">
        <div className="overflow-hidden">
          <HeroMedia
            url={story.hero_photo_url}
            alt={story.headline}
            variant="hero"
          />
        </div>
        <div className="mt-4">
          {story.categories?.[0] ? (
            <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
              {story.categories[0]}
            </div>
          ) : null}
          <h2 className="mt-2 font-headline text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-zinc-900 group-hover:text-brand-red transition-colors">
            {story.headline}
          </h2>
          {story.subline ? (
            <p className="mt-3 text-base sm:text-lg text-zinc-600 leading-relaxed line-clamp-3">
              {story.subline}
            </p>
          ) : null}
          {story.byline ? (
            <div className="mt-3 text-sm text-zinc-500">By {story.byline}</div>
          ) : null}
        </div>
      </Link>
    );
  }

  // v1-style card: subtle border, content padding, hover lift + border
  // shift. Whole surface is clickable and the headline transitions to
  // brand red on hover.
  return (
    <Link
      href={href}
      className="group block bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
    >
      <HeroMedia
        url={story.hero_photo_url}
        alt={story.headline}
        variant="card"
      />
      <div className="px-4 pt-3 pb-4">
        {story.categories?.[0] ? (
          <div className="text-[10px] uppercase tracking-widest text-brand-red font-bold">
            {story.categories[0]}
          </div>
        ) : null}
        <h3 className="mt-1 font-headline text-[15px] font-bold leading-snug text-zinc-900 group-hover:text-brand-red transition-colors line-clamp-3">
          {story.headline}
        </h3>
        {story.byline ? (
          <div className="mt-2 text-[11px] text-zinc-500 font-medium">
            By {story.byline}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
