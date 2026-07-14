import { createClient } from '@/lib/supabase/server';

/** A saved legal notice (typed copy) in the Legal Notices database. */
export type LegalNotice = {
  id: string;
  label: string;
  /** Printed title above the notice (null → PUBLIC NOTICE). */
  header: string | null;
  body: string;
  created_at: string;
};

const COLS = 'id, label, header, body, created_at';

/** All saved notices, newest first — feeds the "Add New Legal" picker. */
export async function getLegalNotices(): Promise<LegalNotice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('legal_notices')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    // Pre-migration-035 fallback: the header column doesn't exist yet.
    const retry = await supabase
      .from('legal_notices')
      .select('id, label, body, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (retry.error) {
      console.error('[getLegalNotices]', error);
      return [];
    }
    return (retry.data ?? []).map((r) => ({ ...r, header: null })) as LegalNotice[];
  }
  return (data ?? []) as LegalNotice[];
}
