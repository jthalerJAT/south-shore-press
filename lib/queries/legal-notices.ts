import { createClient } from '@/lib/supabase/server';

/** A saved legal notice (typed copy) in the Legal Notices database. */
export type LegalNotice = {
  id: string;
  label: string;
  body: string;
  created_at: string;
};

const COLS = 'id, label, body, created_at';

/** All saved notices, newest first — feeds the "Add New Legal" picker. */
export async function getLegalNotices(): Promise<LegalNotice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('legal_notices')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[getLegalNotices]', error);
    return [];
  }
  return (data ?? []) as LegalNotice[];
}
