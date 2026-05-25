/**
 * Single source of truth for site-wide chrome: brand name, tagline,
 * section nav, and social links. Imported by Header / Footer / metadata
 * helpers so we change one place when the masthead evolves.
 *
 * Section list mirrors v1 (CATEGORIES constant in southshorepress/src/App.jsx
 * lines 19-29) so editor URLs and reader bookmarks stay continuous when we
 * cut the domain over.
 */

export type SiteSection = {
  /** Slug used in URLs: /local, /state, etc. */
  slug: string;
  /** Display label shown in nav. */
  label: string;
};

export const SITE_SECTIONS: ReadonlyArray<SiteSection> = [
  { slug: 'local', label: 'Local' },
  { slug: 'state', label: 'State' },
  { slug: 'national', label: 'Nation' },
  { slug: 'world', label: 'World' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'crime', label: 'Crime' },
  { slug: 'opinion', label: 'Opinion' },
  { slug: 'legals', label: 'Legals' },
  { slug: 'video-vault', label: 'Video Vault' },
] as const;

export const SITE = {
  name: 'The South Shore Press',
  tagline: 'From Long Island to the World',
  // Used in copyright + JSON-LD publisher field.
  publisher: 'The South Shore Press',
  // External profiles. Placeholder URLs — replace with real handles before
  // launching Phase 6 (social integrations).
  social: {
    x: 'https://x.com/southshorepress',
    youtube: 'https://www.youtube.com/@southshorepress',
    instagram: 'https://www.instagram.com/southshorepress',
  },
} as const;
