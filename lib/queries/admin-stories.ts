import { createClient } from '@/lib/supabase/server';

/**
 * Master Admin Stories queries (migration 044). RLS: only the pinned master
 * admin can read/write admin_stories; the ingest API writes with the service
 * role. Callers must already be behind requireMasterAdmin().
 */

export type AdminStorySource = 'ai' | 'admin';
export type AdminStoryStatus = 'admin_draft' | 'pushed';

export type AdminStoryRow = {
  id: string;
  headline: string;
  subline: string | null;
  byline: string | null;
  categories: string[];
  hero_photo_url: string | null;
  source: AdminStorySource;
  status: AdminStoryStatus;
  pushed_story_id: string | null;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** One turn of the AI conversation on an admin story. */
export type AiTurn = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
  /** Assistant turns only: true when this reply also applied an edit. */
  applied?: boolean;
  /** Assistant turns only: URLs consulted when web lookup was on. */
  citations?: string[];
};

export type AdminStory = AdminStoryRow & {
  body: string | null;
  extra_photo_urls: string[];
  photo_caption: string | null;
  photo_credit: string | null;
  /** Saved AI conversation (migration 046); [] when none or pre-046. */
  ai_thread: AiTurn[];
};

/** True when the error means admin_stories does not exist yet. */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /could not find the table .*admin_stories|relation .*admin_stories.* does not exist/i.test(error.message ?? '');
}

const ROW_COLS =
  'id, headline, subline, byline, categories, hero_photo_url, source, status, pushed_story_id, pushed_at, created_at, updated_at';
const FULL_COLS = `${ROW_COLS}, body, extra_photo_urls, photo_caption, photo_credit`;

/** Reverse-chron list: every admin draft, plus recently pushed rows (kept
 *  30 days so the master admin can see what went to the Story Editor). */
export async function getAdminStories(): Promise<{ rows: AdminStoryRow[]; error: string | null }> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('admin_stories')
    .select(ROW_COLS)
    .or(`status.eq.admin_draft,and(status.eq.pushed,created_at.gte.${cutoff})`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[getAdminStories]', error);
    // Table missing (migration 044 not applied yet): Postgres says 42P01,
    // PostgREST's schema cache says PGRST205 — surface either as 'migration'.
    return { rows: [], error: isMissingTable(error) ? 'migration' : error.message };
  }
  return { rows: (data ?? []) as AdminStoryRow[], error: null };
}

/** True when the error means the ai_thread column is missing (pre-046). */
export function isMissingAiThread(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (error.code === '42703' || error.code === 'PGRST204') && /ai_thread/i.test(error.message ?? '')
    || /ai_thread.*(does not exist|could not find|schema cache)/i.test(error.message ?? '');
}

export async function getAdminStory(id: string): Promise<AdminStory | null> {
  const supabase = createClient();
  let { data, error } = await supabase
    .from('admin_stories')
    .select(`${FULL_COLS}, ai_thread`)
    .eq('id', id)
    .maybeSingle();
  if (error && isMissingAiThread(error)) {
    // Pre-migration-046: read without the thread column.
    ({ data, error } = await supabase.from('admin_stories').select(FULL_COLS).eq('id', id).maybeSingle());
  }
  if (error) {
    console.error('[getAdminStory]', error);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as AdminStory & { ai_thread?: unknown };
  const thread = Array.isArray(row.ai_thread)
    ? (row.ai_thread as AiTurn[]).filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    : [];
  return { ...row, ai_thread: thread };
}
