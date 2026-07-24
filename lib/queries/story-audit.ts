import { createClient } from '@/lib/supabase/server';

/**
 * Story audit trail reads (table + trigger live in migration 037).
 * RLS limits SELECT to editor-tier accounts; journalists get an empty
 * list back rather than an error, so callers can render unconditionally.
 */

export type StoryAuditEntry = {
  id: number;
  action: 'created' | 'status_change' | 'deleted';
  old_status: string | null;
  new_status: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
};

/** Full trail for one story, newest first. */
export async function getStoryAudit(storyId: string): Promise<StoryAuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('story_audit')
    .select('id, action, old_status, new_status, actor_id, actor_email, actor_name, created_at')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    // Table not yet migrated, or RLS said no — either way the panel just hides.
    return [];
  }
  return (data ?? []) as StoryAuditEntry[];
}
