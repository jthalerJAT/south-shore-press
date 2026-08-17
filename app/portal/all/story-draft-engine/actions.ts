'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { llmComplete, isModelEnabled, DEFAULT_MODEL } from '@/lib/llm';
import { SITE_SECTIONS } from '@/lib/site-config';

/**
 * Story Draft Engine server actions. The editor is the author: they select
 * the candidate, choose the facts, write the angle language, and direct
 * revisions — the model assembles prose from exactly that material.
 */

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
const BASE = '/portal/all/story-draft-engine';

/** House length for an engine-built article (body only, excluding headline
 *  and subhead). Below MIN the draft is retried once with a length nudge. */
const TARGET_WORDS_MIN = 500;
const TARGET_WORDS_MAX = 700;

function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

type Result = { ok: boolean; error?: string };

export type FactChoice = {
  /** candidate_facts.id for existing facts; null for editor-typed ones. */
  id: string | null;
  fact: string;
  include: boolean;
  /** Editor's angle / language to incorporate alongside this fact. */
  angle?: string;
};

function buildPrompt(params: {
  persona: string;
  headline: string;
  summary: string | null;
  facts: FactChoice[];
  extraInstructions?: string;
  priorArticle?: { headline: string; body: string } | null;
  /** Set on the retry after a too-short first draft. */
  lengthNudge?: { priorWords: number } | null;
}): { system: string; user: string } {
  const system = `${params.persona}

You draft newspaper copy for a human editor. Hard rules:
- Use ONLY the facts provided. Never add facts, numbers, names, or quotes from memory.
- Weave the editor's angle notes into the story faithfully — they carry the editor's voice and framing and take precedence over neutrality.
- Inverted pyramid, AP style. No headline puns unless the angle notes ask.
- LENGTH: the body MUST run ${TARGET_WORDS_MIN}–${TARGET_WORDS_MAX} words. This is a full-length print article, not a brief. Reach that length by developing every provided fact fully — give each its own paragraph or more, explain what it means and why it matters to readers, connect facts to one another, and expand the editor's angle notes into full context and analysis. Do NOT pad with generalities, and do NOT reach length by inventing anything not in the fact list. Never return a body under ${TARGET_WORDS_MIN} words.
- Return STRICT JSON, nothing else: {"headline": "...", "subline": "...", "body": "..."}
- body: plain text paragraphs separated by blank lines. No markdown, no citations.`;

  const factLines = params.facts
    .filter((f) => f.include)
    .map((f, i) => {
      const angle = f.angle?.trim();
      return `${i + 1}. FACT: ${f.fact}${angle ? `\n   EDITOR'S ANGLE: ${angle}` : ''}`;
    })
    .join('\n');

  let user = `Subject: ${params.headline}\n`;
  if (params.summary) user += `Background: ${params.summary}\n`;
  user += `\nFacts to include (with the editor's angle notes):\n${factLines}\n`;
  if (params.priorArticle) {
    user += `\nYou previously drafted this article:\nHEADLINE: ${params.priorArticle.headline}\n---\n${params.priorArticle.body}\n---\n`;
    user += `The editor wants it revised. Apply these instructions to the draft above (keep everything else intact):\n${params.extraInstructions ?? ''}\n`;
  } else if (params.extraInstructions?.trim()) {
    user += `\nAdditional instructions from the editor:\n${params.extraInstructions.trim()}\n`;
  }
  user += `\nTarget body length: ${TARGET_WORDS_MIN}–${TARGET_WORDS_MAX} words.`;
  if (params.lengthNudge) {
    user += `\nYOUR PREVIOUS ATTEMPT WAS ONLY ${params.lengthNudge.priorWords} WORDS — far too short. Rewrite at full length (${TARGET_WORDS_MIN}–${TARGET_WORDS_MAX} words) by developing each fact and angle note in depth. Do not add outside facts.`;
  }
  user += `\nReturn the JSON now.`;
  return { system, user };
}

function parseArticle(
  raw: string
): { headline: string; subline: string | null; body: string } | null {
  // The model is instructed to return bare JSON; tolerate code fences.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const obj = JSON.parse(cleaned) as { headline?: string; subline?: string; body?: string };
    const headline = (obj.headline ?? '').trim();
    const body = (obj.body ?? '').trim();
    if (!headline || !body) return null;
    return { headline, subline: (obj.subline ?? '').trim() || null, body };
  } catch {
    return null;
  }
}

/** Generate (or regenerate) the candidate's article from the editor's fact
 *  selections, angle notes, byline choice, and optional revision notes. */
export async function generateArticle(
  candidateId: string,
  input: {
    facts: FactChoice[];
    byline: string;
    extraInstructions?: string;
  }
): Promise<Result> {
  const user = await requireRole([...EDITOR_ROLES], BASE);
  const included = input.facts.filter((f) => f.include && f.fact.trim());
  if (included.length === 0) {
    return { ok: false, error: 'Include at least one fact.' };
  }
  if (!input.byline?.trim()) {
    return { ok: false, error: 'Choose a byline.' };
  }

  const admin = createAdminClient();
  const { data: candidate } = await admin
    .from('story_candidates')
    .select('id, headline, summary, status, article_headline, article_body')
    .eq('id', candidateId)
    .maybeSingle();
  if (!candidate || candidate.status === 'drafted' || candidate.status === 'deleted') {
    return { ok: false, error: 'Candidate not found (it may already be drafted).' };
  }

  let { data: writer } = await admin
    .from('writers')
    .select('persona, model')
    .eq('name', input.byline.trim())
    .maybeSingle();
  if (!writer) {
    // Pre-migration-042 fallback (model column doesn't exist yet).
    const retry = await admin
      .from('writers')
      .select('persona')
      .eq('name', input.byline.trim())
      .maybeSingle();
    writer = retry.data ? { ...retry.data, model: null } : null;
  }

  // The writer profile chooses the LLM (writers.model, e.g. 'grok-4' or
  // 'claude-sonnet-5'); unset falls back to the engine default.
  const model =
    (writer as { model?: string | null } | null)?.model?.trim() || DEFAULT_MODEL;
  const modelGate = isModelEnabled(model);
  if (!modelGate.ok) {
    return { ok: false, error: modelGate.error };
  }

  const isRevision = Boolean(input.extraInstructions?.trim() && candidate.article_body);
  const promptBase = {
    persona:
      (writer as { persona?: string | null } | null)?.persona ??
      'You are a newspaper reporter. AP style, inverted pyramid.',
    headline: candidate.headline as string,
    summary: (candidate.summary as string | null) ?? null,
    facts: input.facts,
    extraInstructions: input.extraInstructions,
    priorArticle: isRevision
      ? {
          headline: (candidate.article_headline as string) ?? '',
          body: (candidate.article_body as string) ?? '',
        }
      : null,
  };

  const draftOnce = async (lengthNudge: { priorWords: number } | null) => {
    const prompt = buildPrompt({ ...promptBase, lengthNudge });
    const res = await llmComplete({ model, system: prompt.system, user: prompt.user, maxTokens: 6000 });
    if (!res.ok) return { error: res.error } as const;
    const article = parseArticle(res.text);
    if (!article) {
      console.error('[generateArticle] unparseable output', res.text.slice(0, 300));
      return { error: 'The model returned an unusable draft — try again.' } as const;
    }
    return { article } as const;
  };

  // House length is 500–700 words. If the first pass comes in short, retry
  // once with an explicit nudge and keep whichever draft is longer.
  let first = await draftOnce(null);
  if ('error' in first) return { ok: false, error: first.error };
  let article = first.article;
  const firstWords = wordCount(article.body);
  if (firstWords < TARGET_WORDS_MIN) {
    console.warn(`[generateArticle] draft was ${firstWords} words (< ${TARGET_WORDS_MIN}); retrying with length nudge`);
    const second = await draftOnce({ priorWords: firstWords });
    if (!('error' in second) && wordCount(second.article.body) > firstWords) {
      article = second.article;
    }
  }

  // Persist any editor-typed facts so the record shows the full human fact set.
  const newFacts = input.facts.filter((f) => !f.id && f.fact.trim());
  if (newFacts.length) {
    const { count } = await admin
      .from('candidate_facts')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidateId);
    await admin.from('candidate_facts').insert(
      newFacts.map((f, i) => ({
        candidate_id: candidateId,
        fact: f.fact.trim(),
        source_label: 'editor',
        fact_order: (count ?? 0) + i,
        added_by: user.id,
      }))
    );
  }

  const { error: updErr } = await admin
    .from('story_candidates')
    .update({
      status: 'generated',
      article_headline: article.headline,
      article_subline: article.subline,
      article_body: article.body,
      byline: input.byline.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId);
  if (updErr) {
    console.error('[generateArticle] save', updErr);
    return { ok: false, error: 'Draft generated but could not be saved — try again.' };
  }

  revalidatePath(`${BASE}/${candidateId}`);
  revalidatePath(BASE);
  return { ok: true };
}

/** Move the generated article into the Story Editor as a draft; the candidate
 *  leaves the engine. The acting editor becomes the story's author. */
export async function moveToDraft(candidateId: string): Promise<Result> {
  const user = await requireRole([...EDITOR_ROLES], BASE);
  const admin = createAdminClient();
  const { data: c } = await admin
    .from('story_candidates')
    .select('id, status, section, article_headline, article_subline, article_body, byline')
    .eq('id', candidateId)
    .maybeSingle();
  if (!c || c.status !== 'generated' || !c.article_body) {
    return { ok: false, error: 'Generate the article first.' };
  }

  const validSections = new Set(SITE_SECTIONS.map((s) => s.slug));
  const section = (c.section as string | null) ?? '';
  const categories = validSections.has(section) ? [section] : ['local'];

  const { data: story, error } = await admin
    .from('stories')
    .insert({
      headline: c.article_headline,
      subline: c.article_subline,
      body: c.article_body,
      byline: c.byline ?? 'Staff',
      categories,
      status: 'draft',
      author_id: user.id,
    })
    .select('id')
    .single();
  if (error || !story) {
    console.error('[moveToDraft]', error);
    return { ok: false, error: 'Could not create the draft.' };
  }

  await admin
    .from('story_candidates')
    .update({
      status: 'drafted',
      drafted_story_id: story.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId);

  revalidatePath(BASE);
  revalidatePath('/portal/all');
  return { ok: true };
}

/** Remove a candidate from the engine (soft delete — the record survives). */
export async function deleteCandidate(candidateId: string): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const admin = createAdminClient();
  const { error } = await admin
    .from('story_candidates')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', candidateId);
  if (error) {
    console.error('[deleteCandidate]', error);
    return { ok: false, error: 'Could not delete the candidate.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}
