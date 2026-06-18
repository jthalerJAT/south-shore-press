/**
 * Client-safe ad-file helpers (no server imports), so client components can
 * use them without pulling in the server Supabase client. Ad copy + insert
 * orders live in the public `newspaper-ads` bucket.
 */
export const AD_FILES_BUCKET = 'newspaper-ads';

export function adFilePublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${AD_FILES_BUCKET}/${path}`;
}
