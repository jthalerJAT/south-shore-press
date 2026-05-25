import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/site-url';

// Allows everything except internal/auth surfaces. Points crawlers at
// both the main sitemap and the Google News sitemap.
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/signin', '/api/'],
      },
    ],
    sitemap: [`${origin}/sitemap.xml`, `${origin}/news-sitemap.xml`],
    host: origin,
  };
}
