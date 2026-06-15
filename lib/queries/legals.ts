import { createClient } from '@/lib/supabase/server';

/** Public Storage bucket holding the legal-notice PDFs. */
export const LEGALS_BUCKET = 'legals';

export type LegalRecord = {
  id: string;
  legal_date: string; // ISO date (YYYY-MM-DD)
  storage_path: string; // object key within the `legals` bucket
  file_name: string | null;
  created_at: string;
};

/** All legal-notice PDFs, newest first (drives the public dropdown + the
 *  portal list). RLS allows public SELECT. */
export async function getLegalsList(): Promise<LegalRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('legals')
    .select('id, legal_date, storage_path, file_name, created_at')
    .order('legal_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getLegalsList]', error);
    return [];
  }
  return (data ?? []) as LegalRecord[];
}

/** Build the public URL for a legal PDF (the bucket is public). */
export function legalPublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${LEGALS_BUCKET}/${storagePath}`;
}

/** Format an ISO date (YYYY-MM-DD) as "MONTH DAY, YEAR" in US English,
 *  parsed as a local date (no timezone shift). */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
