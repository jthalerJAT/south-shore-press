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

/** One saved notice — the Legal Database's library-entry edit view. */
export async function getLegalNotice(id: string): Promise<LegalNotice | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('legal_notices')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[getLegalNotice]', error);
    return null;
  }
  return data as LegalNotice;
}

/** The WHOLE library, newest first, paginated past Supabase's 1000-row cap —
 *  feeds the Legal Database merge, which must see every L# ever filed. */
export async function getAllLegalNotices(): Promise<LegalNotice[]> {
  const supabase = createClient();
  const out: LegalNotice[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('legal_notices')
      .select(COLS)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[getAllLegalNotices]', error);
      break;
    }
    out.push(...((data ?? []) as LegalNotice[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

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
