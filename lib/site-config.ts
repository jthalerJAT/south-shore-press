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
  { slug: 'business', label: 'Business' },
  { slug: 'opinion', label: 'Opinion' },
  { slug: 'legals', label: 'Legals' },
  { slug: 'video-vault', label: 'Video Vault' },
] as const;

/**
 * Sports sub-categories. These are story-level tags, NOT standalone
 * sections — there's no /local-sports page, and they don't appear in
 * the header nav. They live inside /sports as collapsible blocks +
 * help the editor classify sports coverage finer than the parent tag.
 *
 * When an editor checks any of these on the story form, the save
 * action auto-adds 'sports' to the categories array so the story
 * still shows in the homepage Sports rail + the /sports recent rail.
 */
export const SPORTS_SUBCATEGORIES: ReadonlyArray<SiteSection> = [
  { slug: 'local-sports', label: 'Local Sports' },
  { slug: 'pro-sports', label: 'Pro Sports' },
  { slug: 'fantasy-sports', label: 'Fantasy Sports' },
] as const;

/**
 * Special category that marks a story as PRINT EDITION ONLY: it's saved and
 * shows in every editor list (and the Newspaper Creator story bank), but is
 * excluded from every public-facing query, so it never appears anywhere on
 * the website. NOT a nav section / route — it has no public page.
 */
export const PRINT_ONLY_SLUG = 'print-only';
export const PRINT_ONLY_LABEL = 'Print Edition Only';

export const SITE = {
  name: 'The South Shore Press',
  tagline: 'From Long Island to the World',
  // Used in copyright + JSON-LD publisher field.
  publisher: 'The South Shore Press',
  // Masthead + footer logo (Cloudinary, 3272×824 ≈ 4:1). next.config allows
  // all https image hosts, so no remotePatterns change is needed.
  logoUrl:
    'https://res.cloudinary.com/dorcgqudu/image/upload/v1781563840/ssp_transparent_hc7nv9.png',
  // External profiles. Placeholder URLs — replace with real handles before
  // launching Phase 6 (social integrations).
  social: {
    x: 'https://x.com/SSPNewsroom',
    youtube: 'https://www.youtube.com/@southshorepress',
    instagram: 'https://www.instagram.com/southshorepress',
  },
} as const;
