import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { llmComplete, isModelEnabled, DEFAULT_MODEL } from '@/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ingest/story — machine-created stories from the newsroom
 * pipeline. Token-guarded: `x-ssp-ingest-token` must match STORY_INGEST_TOKEN.
 *
 * Since the Story Draft Engine (migration 041), incoming auto-drafts are
 * CONVERTED TO CANDIDATES by default: the article is decomposed into an
 * atomic fact list and filed in story_candidates for an editor to rebuild
 * with their own fact selection and angle. This redirects the old pipeline
 * into the engine without touching the office PC.
 *
 *   INGEST_STORY_MODE=draft     → restore the legacy behavior (draft story)
 *   extraction failure          → falls back to the legacy draft path, so a
 *                                 story is never lost
 */

type IngestBody = {
  headline?: string;
  subline?: string;
  body?: string;
  byline?: string;
  categories?: string[];
};

const EXTRACT_SYSTEM = `You decompose a news article into its atomic facts for an editor's story-building tool.

Rules:
- Extract 6-14 facts. One factual claim per fact, stated neutrally in your own words.
- Use ONLY what the article says. No outside knowledge, no speculation.
- Attributed statements stay attributed ("Supervisor Romaine said ...").
- Also write a 1-2 sentence neutral summary of the subject.

Return STRICT JSON, nothing else:
{"summary": "...", "facts": [{"fact": "..."}]}`;

/** Pipeline sections → site section slugs (the pipeline says 'nation'). */
function mapSection(cat: string | undefined): string | null {
  const c = (cat ?? '').toLowerCase().trim();
  if (!c) return null;
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
      ? payload.categories.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
      : ['business'];
  const byline = (payload.byline ?? '').trim() || 'Business Desk';
  const subline = (payload.subline ?? '').trim() || null;

  const legacyMode = process.env.INGEST_STORY_MODE === 'draft';

  // ── Candidate conversion (default) ────────────────────────────────────────
  if (!legacyMode && isModelEnabled(DEFAULT_MODEL).ok) {
    try {
      const res = await llmComplete({
        system: EXTRACT_SYSTEM,
        user: `HEADLINE: ${headline}\n${subline ? `SUBHEAD: ${subline}\n` : ''}\nARTICLE:\n${body}\n\nReturn the JSON now.`,
        maxTokens: 3000,
      });
      if (res.ok) {
        const cleaned = res.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned) as {
          summary?: string;
          facts?: Array<{ fact?: string }>;
        };
        const facts = (parsed.facts ?? [])
          .map((f) => (f.fact ?? '').trim())
          .filter(Boolean);
        if (facts.length >= 3) {
          const admin = createAdminClient();
          const { data: candidate, error } = await admin
            .from('story_candidates')
            .insert({
              headline,
              summary: (parsed.summary ?? '').trim() || subline,
              section: mapSection(categories[0]),
              suggested_byline: byline,
              sources: [],
              status: 'pending',
            })
            .select('id')
            .single();
          if (!error && candidate) {
            const { error: fErr } = await admin.from('candidate_facts').insert(
              facts.map((fact, i) => ({
                candidate_id: candidate.id,
                fact,
                source_label: byline,
                fact_order: i,
              }))
            );
            if (!fErr) {
              return NextResponse.json({
                ok: true,
                mode: 'candidate',
                id: candidate.id,
                enginePath: `/portal/all/story-draft-engine/${candidate.id}`,
              });
            }
            console.error('[ingest/story→candidate] facts', fErr);
          } else {
            console.error('[ingest/story→candidate]', error);
          }
        } else {
          console.error('[ingest/story→candidate] too few facts extracted');
        }
      } else {
        console.error('[ingest/story→candidate] extraction', res.error);
      }
    } catch (err) {
      console.error('[ingest/story→candidate] failed, falling back to draft', err);
    }
    // fall through to the legacy draft path on any failure
  }

  // ── Legacy draft path ─────────────────────────────────────────────────────
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
