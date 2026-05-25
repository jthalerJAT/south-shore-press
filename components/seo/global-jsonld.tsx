import { SITE } from '@/lib/site-config';
import { getSiteOrigin } from '@/lib/site-url';

/**
 * Organization + WebSite JSON-LD emitted in the <body> of every page via
 * the root layout. Google reads these to establish:
 *   - Publisher identity (logo, name, social profiles → Knowledge Panel)
 *   - Site-wide search action (powers the Google "sitelinks search box")
 *
 * Two top-level objects in one <script> tag, wrapped in @graph so they
 * share context. This is the canonical Schema.org pattern for emitting
 * multiple entities together.
 */
export function GlobalJsonLd() {
  const origin = getSiteOrigin();

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsMediaOrganization',
        '@id': `${origin}/#organization`,
        name: SITE.publisher,
        url: origin,
        // Logo — placeholder for now, swap to real wordmark file when
        // we ship one. Google requires logo to be at least 112x112 and
        // accessible to googlebot.
        logo: {
          '@type': 'ImageObject',
          url: `${origin}/logo.png`,
        },
        sameAs: [SITE.social.x, SITE.social.youtube, SITE.social.instagram],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: SITE.name,
        description: SITE.tagline,
        publisher: { '@id': `${origin}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/search?q={search_term_string}`,
          },
          // schema.org requires a query-input on SearchAction
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
