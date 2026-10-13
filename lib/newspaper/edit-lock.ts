/**
 * Edit locks — one editor at a time per page (publisher direction 2026-10-12).
 *
 * Whole-page editors save the page as a single blob, so two people with the
 * same page open meant the last save silently overwrote the first. Opening an
 * editor CLAIMS it; anyone else gets a read-only view naming the holder. The
 * claim lives until the tab closes or 60 minutes pass with no heartbeat.
 *
 * Client-safe (no server imports): both the API route and the browser hook
 * import these.
 */

/** No heartbeat for this long ⇒ the claim is stale and can be taken. Long on
 *  purpose: someone who steps away mid-edit must not lose the page. */
export const LOCK_IDLE_MS = 60 * 60 * 1000;
/** How often an open editor says "still here". */
export const LOCK_HEARTBEAT_MS = 60 * 1000;
/** A holder's OWN new window may reclaim after this much heartbeat silence
 *  (2026-10-19: a window that died without its release beacon locked the
 *  publisher out of his own page for the full hour). A live window heartbeats
 *  every minute, so 3½ minutes of silence means that window is gone — and the
 *  claim still belongs to the same person, so "whoever opened it keeps it"
 *  holds. OTHER people still wait the full LOCK_IDLE_MS. */
export const LOCK_SELF_STALE_MS = 3 * LOCK_HEARTBEAT_MS + 30 * 1000;

export type LockScope = string;

/** A single page's editor (content, layout, and every template editor). */
export function pageScope(pageId: string): LockScope {
  return `page:${pageId}`;
}

/** The Election Coverage SECTION: every election page edits one stored
 *  section, so they share a single claim per issue variant. */
export function electionScope(variant: string): LockScope {
  return `election:${variant || 'standard'}`;
}

export type LockHolder = {
  name: string;
  /** ISO timestamp of when they opened it. */
  since: string;
  /** The holder is THIS user in another window/terminal (migration 052). The
   *  banner says "you" rather than naming them like a colleague. */
  self?: boolean;
};

export type LockState =
  | { state: 'editing' }
  /** The lock table isn't there yet (migration 051 unapplied) — everyone
   *  edits, exactly as before locks existed. */
  | { state: 'editing'; degraded: true }
  | { state: 'readonly'; holder: LockHolder };

export type LockAction = 'claim' | 'heartbeat' | 'release';

/** "since 10:05 AM" / "since Mon 10:05 AM" for the read-only banner. */
export function describeSince(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const sameDay = new Date().toDateString() === then.toDateString();
  const time = then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay
    ? time
    : `${then.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}
