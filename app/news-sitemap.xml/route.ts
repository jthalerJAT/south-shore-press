import { NextResponse } from 'next/server';
import { SITE } from '@/lib/site-config';
import { getSiteOrigin } from '@/lib/site-url';
import { buildStoryPath } from '@/lib/slugify';
import { getRecentStoriesForNewsSitemap } from '@/lib/queries/stories-meta';

// Google News-specific sitemap. Distinct format from the main sitemap
// (custom `news:` XML namespace), so MetadataRoute.Sitemap can't produce
// it — we hand-render the XML.
//
// Google News only indexes URLs added to this sitemap within the last
// 48 hours of their <news:publication_date>; the query is filtered to
// that window already.
//
// Cache:
//   - 5 minutes at the edge so a burst of crawler hits doesn't trample
//     Supabase
//   - stale-while-revalidate so the next request after expiry still gets
//     a fast response while we refresh in the background

export const revalidate = 300;

/** XML-escape a string for safe inclusion in element text / attributes. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const origin = getSiteOrigin();
  const stories = await getRecentStoriesForNewsSitemap();

  const entries = stories
    .map((s) => {
      const loc = `${origin}${buildStoryPath({
        id: s.id,
        headline: s.headline,
        categories: s.categories,
      })}`;
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE.publisher)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${s.published_at}</news:publication_date>
      <news:title>${escapeXml(s.headline)}</news:title>
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Edge cache for 5 min, serve stale up to 1 hour while revalidating
      'Cache-Control':
        'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
