import { NextResponse } from 'next/server';
import { getCurrentUser, EDITOR_TIER_ROLES } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LOCK_IDLE_MS, type LockAction, type LockState } from '@/lib/newspaper/edit-lock';

/**
 * Edit-lock endpoint — claim / heartbeat / release for one editor scope.
 *
 * A route handler (not a server action) because the browser must be able to
 * release the claim during page unload, which only `fetch(..., {keepalive})`
 * survives.
 *
 * Unapplied migration 051 (no table) degrades to "everyone can edit", the
 * behaviour before locks existed — a missing table must never block the paper
 * from being built.
 */
export const dynamic = 'force-dynamic';

type Row = {
  scope: string;
  user_id: string;
  user_name: string | null;
  /** Which browser window holds it (migration 052); null before that. */
  session_id?: string | null;
  claimed_at: string;
  last_seen_at: string;
};

/** Postgres "relation does not exist" (PostgREST surfaces it as PGRST205). */
function missingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

/** Migration 052 (session_id) not applied yet — write without that column. */
function missingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.roles.some((r) => EDITOR_TIER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  }

  let body: { scope?: string; action?: LockAction; session?: string };
  try {
    body = (await request.json()) as { scope?: string; action?: LockAction; session?: string };
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const scope = (body.scope ?? '').trim();
  const action: LockAction = body.action ?? 'claim';
  // One window per claim: the same person on two terminals must not both edit.
  const session = (body.session ?? '').trim();
  if (!scope) return NextResponse.json({ error: 'Missing scope.' }, { status: 400 });

  const supabase = createClient();
  const me = { user_id: user.id, user_name: user.displayName || user.email };
  const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };
  const ok = (state: LockState) => NextResponse.json(state, noStore);

  if (action === 'release') {
    // Only the window that holds it may release it — otherwise closing your
    // second (read-only) tab would free someone else's claim.
    const mineQuery = () =>
      supabase.from('np_edit_locks').delete().eq('scope', scope).eq('user_id', user.id);
    let query = mineQuery();
    if (session) query = query.or(`session_id.eq.${session},session_id.is.null`);
    let { error } = await query;
    // Migration 052 unapplied — release without the window filter.
    if (error && missingColumn(error)) ({ error } = await mineQuery());
    if (error && !missingTable(error)) console.error('[edit-lock] release', error);
    return ok({ state: 'editing' });
  }

  const { data, error } = await supabase
    .from('np_edit_locks')
    .select('*')
    .eq('scope', scope)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return ok({ state: 'editing', degraded: true });
    console.error('[edit-lock] read', error);
    // Never block editing on a lock-table hiccup.
    return ok({ state: 'editing', degraded: true });
  }

  const row = data as Row | null;
  const now = Date.now();
  const stale = row ? now - new Date(row.last_seen_at).getTime() > LOCK_IDLE_MS : true;
  const sameUser = row?.user_id === user.id;
  // Before migration 052 (no session_id stored) a claim belongs to the user as
  // a whole, so their other window counts as the same holder — 051 behaviour.
  const sameWindow = sameUser && (!row?.session_id || !session || row.session_id === session);

  // Held and still alive — read-only, no takeover. That includes YOUR other
  // window: two tabs of one login overwrote each other just like two people.
  if (row && !sameWindow && !stale) {
    return ok({
      state: 'readonly',
      holder: {
        name: row.user_name || 'Another editor',
        since: row.claimed_at,
        ...(sameUser ? { self: true } : {}),
      },
    });
  }

  // A heartbeat must not resurrect a claim the holder released (e.g. they
  // closed the tab) — only an explicit claim re-takes a free scope.
  if (action === 'heartbeat' && !row) return ok({ state: 'editing' });

  const nowIso = new Date(now).toISOString();
  const base = {
    scope,
    ...me,
    // Keep the original claim time while this window keeps it, so the banner
    // shows when editing actually started.
    claimed_at: sameWindow && row ? row.claimed_at : nowIso,
    last_seen_at: nowIso,
  };
  let { error: upErr } = await supabase
    .from('np_edit_locks')
    .upsert({ ...base, session_id: session || null }, { onConflict: 'scope' });
  if (upErr && missingColumn(upErr)) {
    // Migration 052 unapplied — claim without the window id (051 behaviour).
    ({ error: upErr } = await supabase
      .from('np_edit_locks')
      .upsert(base, { onConflict: 'scope' }));
  }
  if (upErr) {
    if (missingTable(upErr)) return ok({ state: 'editing', degraded: true });
    console.error('[edit-lock] claim', upErr);
    return ok({ state: 'editing', degraded: true });
  }
  return ok({ state: 'editing' });
}
