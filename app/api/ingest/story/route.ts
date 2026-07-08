import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/story — machine-created story drafts (the business-desk
 * writer agent). Token-guarded like the print API; the caller sends
 * `x-ssp-ingest-token` matching STORY_INGEST_TOKEN.
 *
 * Safety rails: everything lands as status='draft' (never published directly),
 * author_id stays null (the byline text identifies the desk), and categories
 * default to ['business']. An editor reviews + publishes in the Story Editor.
 */

type IngestBody = {
  headline?: string;
  subline?: string;
  body?: string;
  byline?: string;
  categories?: string[];
};

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
      ? payload.categories.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
      : ['business'];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('stories')
    .insert({
      headline,
      subline: (payload.subline ?? '').trim() || null,
      body,
      byline: (payload.byline ?? '').trim() || 'Business Desk',
      categories,
      status: 'draft',
      author_id: null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[ingest/story]', error);
    return NextResponse.json({ error: 'Could not create the draft.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    editPath: `/portal/edit/${data.id}`,
  });
}
