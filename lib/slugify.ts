/**
 * URL slug helpers for stories. v1 has no `slug` column on the `stories`
 * table — stories are keyed by UUID. To get human-readable, SEO-friendly
 * URLs without requiring a schema migration on day one, we use the pattern:
 *
 *     /<section>/<headline-slug>-<shortHex>
 *
 * where shortHex is the first 8 hex chars of the UUID (with the dash
 * stripped) and acts as the actual lookup key. The slug portion is purely
 * for humans + search engines.
 *
 * Example URL:
 *     /local/budget-vote-passes-monday-7a3b2c1d
 *
 * Forward-compatible: when we add a real `slug` column later, we can swap
 * `parseStoryShortId` to look up by full slug first, fall back to short id.
 */

/** Lowercase, alphanumeric + hyphens only, no leading/trailing hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (encoding-safe)
    .replace(/['"]/g, '') // drop apostrophes/quotes outright (don't replace with -)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80); // hard cap so URLs stay sane
}

/** First 8 hex chars of a UUID, dashes stripped. */
export function shortIdFromUuid(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 8).toLowerCase();
}

/**
 * Build the full URL path for a story. Picks the first category as the
 * canonical section — duplicates in other categories will set their
 * canonical link back to this URL.
 */
export function buildStoryPath(args: {
  id: string;
  headline: string;
  categories: string[] | null | undefined;
}): string {
  const section = args.categories?.[0] ?? 'local';
  const slug = `${slugify(args.headline)}-${shortIdFromUuid(args.id)}`;
  return `/${section}/${slug}`;
}

/**
 * Pull the short-id back out of a URL slug. Returns null if the slug
 * doesn't end in an 8-hex-char suffix (caller should 404 in that case).
 */
export function parseShortIdFromSlug(slug: string): string | null {
  const match = slug.match(/-([a-f0-9]{8})$/i);
  return match ? match[1].toLowerCase() : null;
}
