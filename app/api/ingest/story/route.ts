import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/story — machine-written stories from the newsroom
 * pipeline (Howard Roark / Gail Wynand / Henry Cameron on the office PC).
 * Token-guarded: `x-ssp-ingest-token` must match STORY_INGEST_TOKEN.
 *
 * Publisher direction 2026-08-17: the writers write complete articles under
 * their own instructions, and those articles land in MASTER ADMIN STORIES
 * (admin_stories, source 'ai') with headline, subhead, byline and body
 * pre-filled. The master admin edits / AI-revises them there and pushes the
 * ones he wants into the Story Editor as drafts.
 *
 *   INGEST_STORY_MODE=draft  → legacy behavior: post straight into the Story
 *                              Editor as a draft (stories, status draft)
 *   admin_stories missing    → (migration 044 not applied yet) falls back to
 *                              the legacy draft path so a story is never lost
 */

type IngestBody = {
  headline?: string;
  subline?: string;
  body?: string;
  byline?: string;
  categories?: string[];
};

/** Pipeline sections → site section slugs (the pipeline says 'nation'). */
function mapSection(cat: string): string {
  const c = cat.toLowerCase().trim();
  return c === 'nation' ? 'national' : c;
}

async function createLegacyDraft(payload: {
  headline: string;
  subline: string | null;
  body: string;
  byline: string;
  categories: string[];
}) {
  const admin = createAdminClient();
  return admin
    .from('stories')
    .insert({
      headline: payload.headline,
      subline: payload.subline,
      body: payload.body,
      byline: payload.byline,
      categories: payload.categories,
      status: 'draft',
      author_id: null,
    })
    .select('id')
    .single();
}

export async function POST(req: Request) {
  const expected = process.env.STORY_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Ingest is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-ssp-ingest-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as IngestBody;
  const headline = (payload.headline ?? '').trim();
  const body = (payload.body ?? '').trim();
  if (!headline || !body) {
    return NextResponse.json({ error: 'headline and body are required.' }, { status: 400 });
  }
  if (headline.length > 300) {
    return NextResponse.json({ error: 'headline too long.' }, { status: 400 });
  }

  const categories =
    Array.isArray(payload.categories) && payload.categories.length > 0
      ? payload.categories.map((c) => mapSection(String(c))).filter(Boolean)
      : ['business'];
  const byline = (payload.byline ?? '').trim() || 'Business Desk';
  const subline = (payload.subline ?? '').trim() || null;

  const legacyMode = process.env.INGEST_STORY_MODE === 'draft';

  // ── Master Admin Stories (default) ────────────────────────────────────────
  if (!legacyMode) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('admin_stories')
      .insert({
        headline,
        subline,
        body,
        byline,
        categories,
        source: 'ai',
        status: 'admin_draft',
        created_by: null,
      })
      .select('id')
      .single();
    if (!error && data) {
      return NextResponse.json({
        ok: true,
        mode: 'admin_draft',
        id: data.id,
        editPath: `/portal/all/master-admin-stories/${data.id}`,
      });
    }
    // 42P01 = admin_stories does not exist yet (migration 044 not applied).
    // Anything else is unexpected but equally should not lose the story.
    console.error('[ingest/story] admin_stories insert failed, falling back to draft', error);
  }

  // ── Legacy / fallback: Story Editor draft ─────────────────────────────────
  const { data, error } = await createLegacyDraft({ headline, subline, body, byline, categories });
  if (error || !data) {
    console.error('[ingest/story]', error);
    return NextResponse.json({ error: 'Could not create the draft.' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    mode: 'draft',
    id: data.id,
    editPath: `/portal/edit/${data.id}`,
  });
}
