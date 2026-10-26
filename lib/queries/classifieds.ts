import { createClient } from '@/lib/supabase/server';

/** Public Storage bucket holding the classified PDFs. */
export const CLASSIFIEDS_BUCKET = 'classifieds';

export type ClassifiedRecord = {
  id: string;
  classified_date: string; // ISO date (YYYY-MM-DD)
  storage_path: string; // object key within the `classifieds` bucket
  file_name: string | null;
  created_at: string;
};

/** All classified PDFs, newest first (drives the portal list + the newspaper
 *  board's Classifieds tab). RLS allows editor-tier SELECT. */
export async function getClassifiedsList(): Promise<ClassifiedRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classifieds')
    .select('id, classified_date, storage_path, file_name, created_at')
    .order('classified_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getClassifiedsList]', error);
    return [];
  }
  return (data ?? []) as ClassifiedRecord[];
}

export type ClassifiedLibraryAd = {
  id: string;
  storage_path: string;
  file_name: string | null;
  created_at: string;
};

/** The classified-ad LIBRARY (migration 057): every individual ad image ever
 *  uploaded on a classifieds page, newest first, deduplicated by file name
 *  (the same advertiser re-sends the same file weekly - show it once). Feeds
 *  the "reuse a previous classified" dropdown. Service-role read. */
export async function getClassifiedAdLibrary(): Promise<ClassifiedLibraryAd[]> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('classified_ad_library')
    .select('id, storage_path, file_name, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('[getClassifiedAdLibrary]', error);
    return [];
  }
  const rows = (data ?? []) as ClassifiedLibraryAd[];
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = (r.file_name ?? r.storage_path).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Build the public URL for a classified file (the bucket is public). */
export function classifiedPublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${CLASSIFIEDS_BUCKET}/${storagePath}`;
}

/** Format an ISO date (YYYY-MM-DD) as "MONTH DAY, YEAR" (local, no TZ shift). */
export function formatClassifiedDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
