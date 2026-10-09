import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/track/page — site-wide page-view beacon (fired by
 * components/site-view-tracker.tsx on every PUBLIC page load). Increments the
 * day's total in site_views; story pages ALSO fire /api/track/view so the
 * per-article buckets keep working. Public by design, same posture as
 * /api/track/view: fire-and-forget, never surfaces an error to readers.
 */
export async function POST() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('increment_site_view');
    if (error) console.error('[track/page]', error);
  } catch (e) {
    console.error('[track/page]', e);
  }
  return NextResponse.json({ ok: true });
}
