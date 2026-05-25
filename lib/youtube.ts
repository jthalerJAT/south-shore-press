/**
 * YouTube URL helpers. v1 stores both photo URLs and YouTube URLs in the
 * single `hero_photo_url` column on stories — we detect at render time and
 * pick an embed vs an <Image>.
 *
 * Supported URL forms (mirrors v1's regex):
 *   https://www.youtube.com/watch?v=ID
 *   https://youtube.com/watch?v=ID
 *   https://m.youtube.com/watch?v=ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 *   https://youtu.be/ID
 */

const YT_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
];

export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const re of YT_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

export function youTubeEmbedUrl(videoId: string): string {
  // rel=0 keeps related videos from rival channels off the post-roll;
  // modestbranding=1 trims the YT logo. Both legal & widely used.
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/** Auto-generated thumbnail; YouTube always serves a maxresdefault for
 *  recent videos, falls back to hqdefault for older ones. We use hq
 *  which is universally available. */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
