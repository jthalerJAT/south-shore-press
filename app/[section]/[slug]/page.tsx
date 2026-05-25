import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { HeroMedia } from '@/components/story/hero-media';
import {
  getPublishedStoryByShortId,
  type StoryDetail,
} from '@/lib/queries/stories';
import { parseShortIdFromSlug, buildStoryPath } from '@/lib/slugify';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';
import { parseYouTubeId, youTubeThumbnailUrl } from '@/lib/youtube';

// ISR: published article content is essentially immutable, but editors do
// occasionally fix typos / refresh the hero. 60s revalidate keeps the edge
// cache hot for the first hour after publish (peak traffic) without making
// editors wait too long to see corrections appear.
export const revalidate = 60;

type Params = { section: string; slug: string };

// We can't statically pre-render every story (there will be thousands).
// dynamicParams lets Next.js generate-on-demand and then ISR.
export const dynamicParams = true;

async function loadStory(params: Params): Promise<StoryDetail | null> {
  const shortId = parseShortIdFromSlug(params.slug);
  if (!shortId) return null;
  const story = await getPublishedStoryByShortId(shortId);
  if (!story) return null;
  // Section in URL must match one of the story's categories — otherwise
  // 404 to avoid SEO duplicate-content from arbitrary section prefixes.
  if (!story.categories?.includes(params.section)) return null;
  return story;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const story = await loadStory(params);
  if (!story) return { title: 'Story not found' };

  // Canonical URL = first-category version of this story. If a reader
  // lands on /sports/foo-abc123 for a story whose primary category is
  // 'local', the canonical points back to /local/foo-abc123.
  const canonicalPath = buildStoryPath({
    id: story.id,
    headline: story.headline,
    categories: story.categories,
  });

  const description =
    story.subline ?? story.body?.slice(0, 160) ?? SITE.tagline;

  // Hero image for OG/Twitter cards. YouTube → use the thumbnail.
  const ytId = parseYouTubeId(story.hero_photo_url);
  const ogImage = ytId
    ? youTubeThumbnailUrl(ytId)
    : story.hero_photo_url ?? undefined;

  return {
    title: story.headline,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: story.headline,
      description,
      type: 'article',
      url: canonicalPath,
      publishedTime: story.published_at ?? undefined,
      authors: story.author?.display_name
        ? [story.author.display_name]
        : story.byline
          ? [story.byline]
          : undefined,
      section: story.categories?.[0],
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: story.headline,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function StoryPage({ params }: { params: Params }) {
  const story = await loadStory(params);
  if (!story) notFound();

  const sectionMeta = SITE_SECTIONS.find((s) => s.slug === params.section);
  const publishedDate = story.published_at
    ? new Date(story.published_at)
    : null;
  const formattedDate = publishedDate
    ? publishedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const paragraphs = (story.body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const authorName = story.author?.display_name ?? story.byline ?? null;
  const heroAlt = story.headline;

  // JSON-LD NewsArticle schema — Google News surfaces this prominently
  // when judging story freshness, authorship, and publisher trust. The
  // @id field needs to be an absolute URL, so we resolve the canonical
  // path against the site's public origin.
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://south-shore-press.vercel.app'
  ).replace(/\/$/, '');
  const canonicalPath = buildStoryPath({
    id: story.id,
    headline: story.headline,
    categories: story.categories,
  });
  const canonicalUrl = `${origin}${canonicalPath}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: story.headline,
    description: story.subline ?? undefined,
    image: story.hero_photo_url
      ? [
          parseYouTubeId(story.hero_photo_url)
            ? youTubeThumbnailUrl(parseYouTubeId(story.hero_photo_url)!)
            : story.hero_photo_url,
        ]
      : undefined,
    datePublished: story.published_at ?? undefined,
    dateModified: story.published_at ?? undefined,
    author: authorName
      ? [{ '@type': 'Person', name: authorName }]
      : undefined,
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: SITE.publisher,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    articleSection: story.categories?.[0],
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* JSON-LD: inline, not in <Head>, per Next.js App Router pattern */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {sectionMeta ? (
        <Link
          href={`/${sectionMeta.slug}`}
          className="text-xs uppercase tracking-widest text-brand-red font-semibold hover:text-brand-red-dark transition-colors"
        >
          {sectionMeta.label}
        </Link>
      ) : null}

      <h1 className="mt-3 font-headline text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-zinc-900">
        {story.headline}
      </h1>

      {story.subline ? (
        <p className="mt-4 text-lg sm:text-xl text-zinc-600 leading-relaxed">
          {story.subline}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
        {authorName ? <span>By {authorName}</span> : null}
        {authorName && formattedDate ? <span aria-hidden="true">·</span> : null}
        {formattedDate ? (
          <time dateTime={story.published_at ?? ''}>{formattedDate}</time>
        ) : null}
      </div>

      <div className="mt-8">
        <HeroMedia url={story.hero_photo_url} alt={heroAlt} variant="hero" priority />
      </div>

      <div className="mt-8 prose-story">
        {paragraphs.length === 0 ? (
          <p className="text-zinc-500 italic">No body content.</p>
        ) : (
          paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-lg leading-relaxed text-zinc-800 mb-5 last:mb-0"
            >
              {p}
            </p>
          ))
        )}
      </div>

      {/* Extra photo gallery — quietly skipped when empty */}
      {story.extra_photo_urls && story.extra_photo_urls.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {story.extra_photo_urls.map((url, i) => (
            <div
              key={i}
              className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100"
            >
              <Image
                src={url}
                alt={`${story.headline} — additional photo ${i + 1}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-12 pt-6 border-t border-zinc-200">
        <Link
          href={sectionMeta ? `/${sectionMeta.slug}` : '/'}
          className="text-sm uppercase tracking-widest font-semibold text-brand-red hover:text-brand-red-dark transition-colors"
        >
          ← Back to {sectionMeta?.label ?? 'Home'}
        </Link>
      </div>
    </article>
  );
}
