import { createClient } from '@/lib/supabase/server';

/**
 * Editor-side story queries. These are NOT cached / ISR — they read
 * draft + submitted + unpublished rows that aren't safe to surface to
 * readers, so we always go straight to Supabase (which then enforces
 * row-level security if it's been turned on for the table).
 */

export type EditorStoryRow = {
  id: string;
  headline: string;
  subline: string | null;
  byline: string | null;
  hero_photo_url: string | null;
  categories: string[] | null;
  status: 'draft' | 'submitted' | 'published' | 'unpublished';
  published_at: string | null;
  created_at: string;
  author_id: string | null;
  author: { display_name: string | null } | null;
};

const ROW_COLUMNS = `
  id, headline, subline, byline, hero_photo_url, categories, status,
  published_at, created_at, author_id,
  author:profiles!stories_author_id_fkey(display_name)
`;

/** Stories authored by a given user, every status, newest first. */
export async function getStoriesAuthoredBy(
  authorId: string
): Promise<EditorStoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(ROW_COLUMNS)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getStoriesAuthoredBy]', error);
    return [];
  }
  // Supabase types FK relations as arrays even when the cardinality is
  // many-to-one (one author per story). Cast through `unknown` per
  // Supabase's own escape-hatch guidance for this exact mismatch.
  return (data ?? []) as unknown as EditorStoryRow[];
}

/**
 * Drafts authored by a given user (status = 'draft' only), newest first.
 *
 * Powers the /portal "Story Editor" page where journalists and editors
 * see their own work-in-progress. Once a story moves from draft →
 * submitted (journalist) or → published (editor), it leaves this list.
 * If an editor later downgrades a story back to draft, it reappears in
 * the original author's draft list.
 */
export async function getMyDrafts(
  authorId: string
): Promise<EditorStoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(ROW_COLUMNS)
    .eq('author_id', authorId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getMyDrafts]', error);
    return [];
  }
  return (data ?? []) as unknown as EditorStoryRow[];
}

/** Every story in the system, newest first. Used by the editor / admin
 *  "All Stories" view. */
export async function getAllStoriesForEditor(): Promise<EditorStoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(ROW_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[getAllStoriesForEditor]', error);
    return [];
  }
  // Supabase types FK relations as arrays even when the cardinality is
  // many-to-one (one author per story). Cast through `unknown` per
  // Supabase's own escape-hatch guidance for this exact mismatch.
  return (data ?? []) as unknown as EditorStoryRow[];
}

export type EditorStoryDetail = EditorStoryRow & {
  body: string | null;
  extra_photo_urls: string[] | null;
  photo_caption: string | null;
  photo_credit: string | null;
};

/** Single story by full UUID, for the edit form. */
export async function getStoryForEdit(
  id: string
): Promise<EditorStoryDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(`${ROW_COLUMNS}, body, extra_photo_urls, photo_caption, photo_credit`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getStoryForEdit]', error);
    return null;
  }
  // Same FK-relation cardinality mismatch as the list queries above.
  return ((data ?? null) as unknown as EditorStoryDetail | null) ?? null;
}
