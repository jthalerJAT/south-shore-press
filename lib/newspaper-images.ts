/**
 * Client-safe helpers for editorial print photos (author photos, story photos,
 * captions' images). Stored in the public `newspaper-images` bucket — separate
 * from ad files. No server imports, so client components can use it.
 */
export const NEWSPAPER_IMAGES_BUCKET = 'newspaper-images';

export function imagePublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${NEWSPAPER_IMAGES_BUCKET}/${path}`;
}
