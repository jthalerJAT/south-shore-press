import type { MetadataRoute } from 'next';
import { SITE_SECTIONS } from '@/lib/site-config';
import { getSiteOrigin } from '@/lib/site-url';
import { buildStoryPath } from '@/lib/slugify';
import { getAllPublishedStoriesForSitemap } from '@/lib/queries/stories-meta';

// Regenerate every 10 minutes. The list is mostly stable; the only
// churn is newly-published stories. Crawlers don't need second-by-second
// freshness, and this keeps Supabase load trivial.
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/`,
      changeFrequency: 'hourly',
      priority: 1.0,
      lastModified: new Date(),
    },
    ...SITE_SECTIONS.map((section) => ({
      url: `${origin}/${section.slug}`,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
      lastModified: new Date(),
    })),
  ];

  const stories = await getAllPublishedStoriesForSitemap();
  const storyEntries: MetadataRoute.Sitemap = stories.map((s) => ({
    url: `${origin}${buildStoryPath({
      id: s.id,
      headline: s.headline,
      categories: s.categories,
    })}`,
    lastModified: new Date(s.published_at),
    // News articles trend toward "publish once, rarely change"; weekly
    // is the right hint for crawlers.
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...storyEntries];
}
