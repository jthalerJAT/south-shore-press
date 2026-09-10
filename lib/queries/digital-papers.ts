import { createClient } from '@/lib/supabase/server';

/** Public Storage bucket holding the web-friendly issue PDFs. */
export const DIGITAL_PAPERS_BUCKET = 'digital-papers';

export type DigitalPaperRecord = {
  id: string;
  issue_date: string; // ISO date (YYYY-MM-DD)
  storage_path: string;
  file_name: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
};

/** Every issue PDF, newest first. Editor-tier RLS (migration 047). */
export async function getDigitalPapers(): Promise<{
  rows: DigitalPaperRecord[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('digital_papers')
    .select('id, issue_date, storage_path, file_name, page_count, file_size_bytes, created_at')
    .order('issue_date', { ascending: false });
  if (error) {
    console.error('[getDigitalPapers]', error);
    const missing =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      /digital_papers/i.test(error.message ?? '');
    return { rows: [], error: missing ? 'migration' : error.message };
  }
  return { rows: (data ?? []) as DigitalPaperRecord[], error: null };
}

/** Public URL for an issue PDF (the bucket is public — safe to email). */
export function digitalPaperPublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${DIGITAL_PAPERS_BUCKET}/${storagePath}`;
}
