import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/candidate — story CANDIDATES from the newsroom pipeline
 * (Story Draft Engine, migration 041). Token-guarded exactly like
 * /api/ingest/story: `x-ssp-ingest-token` must match STORY_INGEST_TOKEN.
 *
 * A candidate is a dual-sourced subject plus its extracted facts — no prose.
 * Editors turn candidates into articles in the portal's Story Draft Engine,
 * choosing facts, angle, and byline there.
 */

type IngestCandidateBody = {
  headline?: string;
  summary?: string;
  section?: string;
  suggested_byline?: string;
  sources?: Array<{ outlet?: string; title?: string; url?: string }>;
  facts?: Array<{ fact?: string; source_label?: string } | string>;
};

export async function POST(req: Request) {
  const expected = process.env.STORY_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Ingest is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-ssp-ingest-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as IngestCandidateBody;
  const headline = (payload.headline ?? '').trim();
  if (!headline) {
    return NextResponse.json({ error: 'headline is required.' }, { status: 400 });
  }
  if (headline.length > 300) {
    return NextResponse.json({ error: 'headline too long.' }, { status: 400 });
  }
  const rawFacts = Array.isArray(payload.facts) ? payload.facts : [];
  const facts = rawFacts
    .map((f) =>
      typeof f === 'string'
        ? { fact: f.trim(), source_label: null as string | null }
        : { fact: (f.fact ?? '').trim(), source_label: (f.source_label ?? '').trim() || null }
    )
    .filter((f) => f.fact.length > 0);
  if (facts.length === 0) {
    return NextResponse.json({ error: 'at least one fact is required.' }, { status: 400 });
  }
  const sources = Array.isArray(payload.sources)
    ? payload.sources
        .map((s) => ({
          outlet: (s?.outlet ?? '').trim() || null,
          title: (s?.title ?? '').trim() || null,
          url: (s?.url ?? '').trim() || null,
        }))
        .filter((s) => s.outlet || s.url)
    : [];

  const admin = createAdminClient();
  const { data: candidate, error } = await admin
    .from('story_candidates')
    .insert({
      headline,
      summary: (payload.summary ?? '').trim() || null,
      section: (payload.section ?? '').trim().toLowerCase() || null,
      suggested_byline: (payload.suggested_byline ?? '').trim() || null,
      sources,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !candidate) {
    console.error('[ingest/candidate]', error);
    return NextResponse.json({ error: 'Could not create the candidate.' }, { status: 500 });
  }

  const { error: fErr } = await admin.from('candidate_facts').insert(
    facts.map((f, i) => ({
      candidate_id: candidate.id,
      fact: f.fact,
      source_label: f.source_label,
      fact_order: i,
    }))
  );
  if (fErr) {
    console.error('[ingest/candidate] facts', fErr);
    return NextResponse.json({ error: 'Candidate created but facts failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: candidate.id });
}
