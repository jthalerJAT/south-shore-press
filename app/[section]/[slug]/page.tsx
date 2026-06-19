import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { HeroMedia } from '@/components/story/hero-media';
import { StoryCard } from '@/components/story/story-card';
import {
  getPublishedStoryByShortId,
  getPublishedStoriesBySection,
  type StoryDetail,
} from '@/lib/queries/stories';
import { parseShortIdFromSlug, buildStoryPath } from '@/lib/slugify';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';
import { parseYouTubeId, youTubeThumbnailUrl } from '@/lib/youtube';
import { getSiteOrigin } from '@/lib/site-url';

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
      // Prefer byline (what the editor set) over author.display_name
      // (the account that saved the row) — same reasoning as the
      // visible byline below.
      authors: story.byline
        ? [story.byline]
        : story.author?.display_name
          ? [story.author.display_name]
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

  // "You Might Also Be Interested In" — up to 4 more stories from this same
  // section, excluding the one being read.
  const related = (await getPublishedStoriesBySection(params.section, 5))
    .filter((s) => s.id !== story.id)
    .slice(0, 4);

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

  // Always prefer the BYLINE the editor set on the story. The
  // author.display_name (from the profiles join) is the account that
  // saved the row, which is often a different person — e.g. an admin
  // entering a piece on a contributor's behalf. Only fall back to the
  // account name if the byline was left blank.
  const authorName = story.byline ?? story.author?.display_name ?? null;
  const heroAlt = story.headline;

  // JSON-LD: a @graph holding both the NewsArticle and a BreadcrumbList.
  // Google News surfaces NewsArticle for indexing decisions; breadcrumbs
  // give us nicer SERP presentation. Publisher is a @id reference back
  // to the Organization emitted in GlobalJsonLd on every page.
  const origin = getSiteOrigin();
  const canonicalPath = buildStoryPath({
    id: story.id,
    headline: story.headline,
    categories: story.categories,
  });
  const canonicalUrl = `${origin}${canonicalPath}`;
  const heroImageUrl = (() => {
    if (!story.hero_photo_url) return undefined;
    const yt = parseYouTubeId(story.hero_photo_url);
    return yt ? youTubeThumbnailUrl(yt) : story.hero_photo_url;
  })();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        '@id': `${canonicalUrl}#article`,
        headline: story.headline,
        description: story.subline ?? undefined,
        image: heroImageUrl ? [heroImageUrl] : undefined,
        datePublished: story.published_at ?? undefined,
        dateModified: story.published_at ?? undefined,
        author: authorName
          ? [{ '@type': 'Person', name: authorName }]
          : undefined,
        // Reference the org defined by GlobalJsonLd in app/layout.tsx —
        // avoids re-stating the publisher object on every story.
        publisher: { '@id': `${origin}/#organization` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
        articleSection: story.categories?.[0],
        isAccessibleForFree: true,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${origin}/`,
          },
          ...(sectionMeta
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: sectionMeta.label,
                  item: `${origin}/${sectionMeta.slug}`,
                },
              ]
            : []),
          {
            '@type': 'ListItem',
            position: sectionMeta ? 3 : 2,
            name: story.headline,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* JSON-LD: inline, not in <Head>, per Next.js App Router pattern */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href={sectionMeta ? `/${sectionMeta.slug}` : '/'}
        className="inline-block mb-4 text-sm font-semibold text-zinc-500 hover:text-brand-red transition-colors"
      >
        ← Back to {sectionMeta?.label ?? 'Home'}
      </Link>

      {sectionMeta ? (
        <div className="text-[11px] uppercase tracking-widest text-brand-red font-bold">
          {sectionMeta.label}
        </div>
      ) : null}

      {/* v1 headline scale: ~38px, weight 800, tight leading. Tailwind's
          text-4xl is 36px so we use an explicit value at lg. */}
      <h1 className="mt-3 font-headline text-3xl sm:text-4xl lg:text-[38px] font-extrabold leading-[1.15] tracking-tight text-zinc-900">
        {story.headline}
      </h1>

      {story.subline ? (
        <p className="mt-4 font-headline text-xl sm:text-2xl text-zinc-600 leading-snug italic">
          {story.subline}
        </p>
      ) : null}

      {/* Byline + date row, with bottom border underline (matches v1) */}
      <div className="mt-6 pb-5 border-b border-zinc-200 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500 font-medium">
        {authorName ? <span>By {authorName}</span> : null}
        {authorName && formattedDate ? <span aria-hidden="true">·</span> : null}
        {formattedDate ? (
          <time dateTime={story.published_at ?? ''}>{formattedDate}</time>
        ) : null}
      </div>

      {/* 8px rounded corners on hero — matches v1's --radius */}
      <div className="mt-7">
        <HeroMedia url={story.hero_photo_url} alt={heroAlt} variant="hero" priority />
      </div>

      {/* Body: v1 scale (16px) but with a slightly loosened line-height
          for long-form readability. Paragraph spacing matches v1's 18px. */}
      <div className="mt-7">
        {paragraphs.length === 0 ? (
          <p className="text-zinc-500 italic">No body content.</p>
        ) : (
          paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-[16px] leading-[1.8] text-zinc-700 mb-[18px] last:mb-0 indent-[1.5em]"
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

      {related.length > 0 ? (
        <section className="mt-14 pt-8 border-t-2 border-brand-red">
          <h2 className="font-headline text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 mb-6">
            You Might Also Be Interested In
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {related.map((s) => (
              <StoryCard key={s.id} story={s} variant="standard" />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
