/**
 * Resolve the public site origin (scheme + host, no trailing slash) for
 * absolute URL composition in sitemaps, JSON-LD `@id` fields, OG
 * fallbacks, etc.
 *
 * Order of precedence:
 *   1. NEXT_PUBLIC_SITE_URL (set in Vercel env to the production domain)
 *   2. VERCEL_URL          (auto-set on preview deploys; needs https:// prefix)
 *   3. localhost fallback  (dev)
 */
export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, '');

  return 'http://localhost:3000';
}
