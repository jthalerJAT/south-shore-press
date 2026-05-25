'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildStoryPath } from '@/lib/slugify';
import { parseYouTubeId, youTubeThumbnailUrl } from '@/lib/youtube';
import { cn } from '@/lib/utils';
import type { StoryListItem } from '@/lib/queries/stories';
import { SITE_SECTIONS } from '@/lib/site-config';

const AUTO_ADVANCE_MS = 6000;

/**
 * v1-style rotating hero on the homepage. Renders up to N stories as
 * a single fixed-aspect-ratio frame; each slide is the same area with
 * different content + a dark gradient overlay so the headline + dek
 * stay legible over photography of any tonality.
 *
 * Interaction model:
 *   - Auto-advance every 6s
 *   - Pause when the pointer is over the carousel, or any element
 *     inside it has focus (accessibility — keyboard tabbing through
 *     shouldn't trigger a slide change underneath the user)
 *   - Manual prev/next via the side chevrons
 *   - Whole slide is a Link so click anywhere navigates to the story
 *
 * The image area is `aspect-video` so the carousel keeps a consistent
 * height regardless of which slide is showing; this also gives the
 * homepage layout a predictable hero height for the Top Stories rail
 * to align against.
 */
export function HeroCarousel({ stories }: { stories: StoryListItem[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = stories.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIdx(((next % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  if (count === 0) return null;

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-900 group"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured stories"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {stories.map((story, i) => {
        const isActive = i === idx;
        const ytId = parseYouTubeId(story.hero_photo_url);
        const imgSrc = ytId
          ? youTubeThumbnailUrl(ytId)
          : story.hero_photo_url ?? '';
        const sectionSlug = story.categories?.[0] ?? 'local';
        const sectionLabel =
          SITE_SECTIONS.find((s) => s.slug === sectionSlug)?.label ??
          sectionSlug;
        const href = buildStoryPath({
          id: story.id,
          headline: story.headline,
          categories: story.categories,
        });

        return (
          <Link
            key={story.id}
            href={href}
            aria-hidden={!isActive}
            aria-label={story.headline}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out',
              isActive
                ? 'opacity-100 z-10'
                : 'opacity-0 z-0 pointer-events-none'
            )}
          >
            {imgSrc ? (
              <Image
                src={imgSrc}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
                priority={i === 0}
              />
            ) : null}

            {/* Dark bottom gradient so the headline + dek read on any photo */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

            {/* YouTube play indicator (if the hero is a video) */}
            {ytId ? (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded text-[10px] uppercase tracking-widest text-white font-bold">
                <svg
                  viewBox="0 0 24 24"
                  className="w-3 h-3"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Video
              </div>
            ) : null}

            {/* Text overlay — bottom-aligned */}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 max-w-3xl">
              <span className="inline-block px-2.5 py-1 bg-brand-red text-white text-[10px] sm:text-[11px] uppercase tracking-widest font-bold">
                {sectionLabel}
              </span>
              <h2 className="mt-3 font-headline text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                {story.headline}
              </h2>
              {story.subline ? (
                <p className="mt-2 sm:mt-3 text-xs sm:text-sm md:text-base text-zinc-200 leading-snug line-clamp-2 sm:line-clamp-3">
                  {story.subline}
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}

      {/* Navigation arrows — only render when there's more than one slide */}
      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            aria-label="Previous story"
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-black/45 hover:bg-black/75 text-white rounded-full transition-colors opacity-70 group-hover:opacity-100"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            aria-label="Next story"
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-black/45 hover:bg-black/75 text-white rounded-full transition-colors opacity-70 group-hover:opacity-100"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Slide indicator */}
          <div
            aria-live="polite"
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 bg-black/65 text-white text-[11px] font-semibold px-2 py-0.5 rounded tracking-wider"
          >
            {idx + 1} / {count}
          </div>
        </>
      ) : null}
    </div>
  );
}
