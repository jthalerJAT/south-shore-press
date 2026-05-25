import Image from 'next/image';
import { parseYouTubeId, youTubeEmbedUrl } from '@/lib/youtube';

type Props = {
  url: string | null | undefined;
  alt: string;
  /** Controls layout. 'hero' = full-bleed 16:9, 'card' = 4:3 thumbnail. */
  variant?: 'hero' | 'card';
  /** Mark the hero image as priority so LCP is fast on the story page. */
  priority?: boolean;
};

/**
 * Renders the story's hero media. The `hero_photo_url` column on v1's
 * `stories` table holds either a photo URL or a YouTube URL — we sniff
 * and dispatch. For YouTube on cards we use the thumbnail (cheap, no
 * embed weight); on the actual story page we render an iframe.
 *
 * No client JS — pure server component. The iframe is lazy by default
 * (loading="lazy") so it doesn't block the rest of the article.
 */
export function HeroMedia({ url, alt, variant = 'hero', priority }: Props) {
  if (!url) {
    return (
      <div
        className={
          variant === 'hero'
            ? 'aspect-video w-full bg-zinc-100'
            : 'aspect-[4/3] w-full bg-zinc-100'
        }
        aria-hidden="true"
      />
    );
  }

  const ytId = parseYouTubeId(url);

  // On homepage/category cards we always render a still image — cheaper
  // and avoids dozens of iframes on a single page. For YouTube items we
  // use the auto-generated thumbnail.
  if (variant === 'card') {
    const src = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : url;
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
        {ytId ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-black/70 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-white ml-0.5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Hero variant on story page: real iframe for video, optimized Image
  // for photo.
  if (ytId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <iframe
          src={youTubeEmbedUrl(ytId)}
          title={alt}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
      <Image
        src={url}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 1024px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
