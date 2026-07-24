import type { StoryAuditEntry } from '@/lib/queries/story-audit';

/**
 * StoryHistory — the audit trail panel on the story edit page (editor-tier
 * only; journalists get an empty list from RLS and the panel hides).
 *
 * Every row answers "who did what, when": created / published / unpublished /
 * deleted, the acting account, and the timestamp. Rows with no actor were
 * written OUTSIDE the portal (service key or direct SQL) — flagged loudly,
 * because that's exactly the scenario the trail exists to expose.
 */

function describe(e: StoryAuditEntry): string {
  if (e.action === 'created') {
    return e.new_status === 'published' ? 'Created & published' : `Created (${e.new_status})`;
  }
  if (e.action === 'deleted') return 'Deleted';
  if (e.new_status === 'published') return 'Published';
  if (e.new_status === 'unpublished') return 'Unpublished';
  if (e.new_status === 'submitted') return 'Submitted for review';
  if (e.new_status === 'draft') return 'Moved back to draft';
  return `${e.old_status ?? '?'} → ${e.new_status ?? '?'}`;
}

export function StoryHistory({ entries }: { entries: StoryAuditEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-10 border-t border-zinc-200 pt-6">
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">History</h2>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className="text-xs text-zinc-600 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-zinc-400 tabular-nums">
              {new Date(e.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <span className="font-medium text-zinc-800">{describe(e)}</span>
            <span>by</span>
            {e.actor_id ? (
              <span className="font-medium text-zinc-800">
                {e.actor_name || e.actor_email || e.actor_id.slice(0, 8)}
              </span>
            ) : (
              <span className="font-semibold text-red-600">
                no portal user — service key or direct database write
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
