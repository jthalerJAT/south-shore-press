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

export type AdminStory = AdminStoryRow & {
  body: string | null;
  extra_photo_urls: string[];
  photo_caption: string | null;
  photo_credit: string | null;
};

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
    // 42P01 = table missing (migration 044 not applied yet) — surface that.
    return { rows: [], error: error.code === '42P01' ? 'migration' : error.message };
  }
  return { rows: (data ?? []) as AdminStoryRow[], error: null };
}

export async function getAdminStory(id: string): Promise<AdminStory | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('admin_stories')
    .select(FULL_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getAdminStory]', error);
    return null;
  }
  return (data as AdminStory | null) ?? null;
}
