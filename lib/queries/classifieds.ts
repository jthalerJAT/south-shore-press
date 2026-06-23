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
