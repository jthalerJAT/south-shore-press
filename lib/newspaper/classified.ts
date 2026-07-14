/**
 * Classifieds template-page data — stored in np_pages.template_data for a
 * `classifieds` kind page. Two models coexist:
 *   - COMPOSED (current): individual classified ads (auto-cropped from the
 *     PDFs advertisers send) stacked in two columns, top- and bottom-justified
 *     with even spacing, under the printed running head + THE CLASSIFIEDS
 *     banner, next to the house "LIST YOUR CLASSIFIED AD" rail.
 *   - LEGACY: one uploaded file (from the Classified Upload tile) filling the
 *     whole page. Still rendered when `ads` is empty and `storage_path` set.
 * Pure helpers, server + client.
 */

export const CLASSIFIEDS_BUCKET_PUBLIC = 'classifieds';

/** Public URL for an object in the classifieds bucket (client-safe). */
export function classifiedFileUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${CLASSIFIEDS_BUCKET_PUBLIC}/${path}`;
}

/** One placed classified ad (an image cropped out of the advertiser's PDF). */
export type ClassifiedAd = {
  id: string;
  /** Object key in the `classifieds` Storage bucket (always an image). */
  storage_path: string;
  /** The advertiser's original file name, for the editor list. */
  file_name?: string;
  /** Which ad column the creative stacks in (1 = left, 2 = middle). */
  column: 1 | 2;
};

export type ClassifiedPageData = {
  v: 1;
  // ── legacy single-file model ──
  /** Source classifieds row id (reference only). */
  classified_id?: string;
  /** Object key in the `classifieds` Storage bucket. */
  storage_path?: string;
  file_name?: string;
  // ── composed model ──
  ads?: ClassifiedAd[];
};

export function defaultClassifiedPage(): ClassifiedPageData {
  return { v: 1, ads: [] };
}

function normalizeAd(raw: unknown, i: number): ClassifiedAd | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.storage_path !== 'string' || !r.storage_path) return null;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : `ca-${i}`,
    storage_path: r.storage_path,
    file_name: typeof r.file_name === 'string' ? r.file_name : undefined,
    column: r.column === 2 ? 2 : 1,
  };
}

export function normalizeClassifiedPage(raw: unknown): ClassifiedPageData {
  if (!raw || typeof raw !== 'object') return defaultClassifiedPage();
  const r = raw as Partial<ClassifiedPageData> & { ads?: unknown };
  const ads = Array.isArray(r.ads)
    ? (r.ads as unknown[]).map(normalizeAd).filter((a): a is ClassifiedAd => a !== null)
    : [];
  return {
    v: 1,
    classified_id: r.classified_id,
    storage_path: r.storage_path,
    file_name: r.file_name,
    ads,
  };
}

/** True once the page has any content (composed ads or a legacy file). */
export function classifiedPageHasFile(data: ClassifiedPageData): boolean {
  return Boolean((data.ads && data.ads.length > 0) || data.storage_path);
}

type ClassifiedSource = { id: string; storage_path?: string | null; file_name?: string | null };

/** Assign an uploaded classified (from the Classified Upload library) to the
 *  page — the LEGACY whole-page model. */
export function fillClassifiedFromRecord(
  data: ClassifiedPageData,
  rec: ClassifiedSource
): ClassifiedPageData {
  return {
    ...data,
    classified_id: rec.id,
    storage_path: rec.storage_path ?? undefined,
    file_name: rec.file_name ?? undefined,
  };
}
