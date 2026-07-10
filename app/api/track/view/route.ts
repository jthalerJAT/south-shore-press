import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/track/view — story-view beacon. Fire-and-forget from the client;
 * increments the story's daily view bucket. Public by design (it's a page-view
 * counter); the strict UUID check + RPC keep it harmless.
 */
export async function POST(req: Request) {
  let id = '';
  try {
    const body = (await req.json()) as { id?: string };
    id = String(body.id ?? '');
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('increment_story_view', { p_story_id: id });
    if (error) console.error('[track/view]', error);
  } catch (e) {
    console.error('[track/view]', e);
  }
  // Always 204-style success — the beacon must never surface errors to readers.
  return NextResponse.json({ ok: true });
}
