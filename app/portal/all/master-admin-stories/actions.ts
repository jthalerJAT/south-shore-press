'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, isPinnedMasterAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { llmComplete, isModelEnabled, DEFAULT_MODEL } from '@/lib/llm';
import { SITE_SECTIONS, SPORTS_SUBCATEGORIES, PRINT_ONLY_SLUG } from '@/lib/site-config';
import { isMissingTable } from '@/lib/queries/admin-stories';
import { getHouseStyle, houseStyleBlock, HOUSE_STYLE_KEY } from '@/lib/house-style';

/**
 * Master Admin Stories — server actions. Every action re-checks that the
 * caller is the pinned master admin; RLS on admin_stories enforces the same
 * in the database (migration 044).
 *
 *   saveAdminStory      create/update an Admin Draft (stays in this tile)
 *   pushToStoryEditor   copy the story into `stories` as a normal DRAFT and
 *                       mark the admin row pushed (linked by pushed_story_id)
 *   deleteAdminStory    remove an admin row (a pushed Story Editor draft is
 *                       untouched)
 *   reviseWithAi        apply the master admin's instruction to the article
 *                       via the LLM; returns the revised fields — nothing is
 *                       saved until he clicks Save / Push
 */

const BASE = '/portal/all/master-admin-stories';

const VALID_SECTIONS = new Set([
  ...SITE_SECTIONS.map((s) => s.slug),
  ...SPORTS_SUBCATEGORIES.map((s) => s.slug),
  PRINT_ONLY_SLUG,
]);
const SPORTS_SUBCATEGORY_SLUGS = new Set(SPORTS_SUBCATEGORIES.map((s) => s.slug));
const ROUTE_SECTION_SLUGS = new Set(SITE_SECTIONS.map((s) => s.slug));

export type AdminStoryInput = {
  headline: string;
  subline: string;
  byline: string;
  body: string;
  categories: string[];
  hero_photo_url: string;
  photo_caption: string;
  photo_credit: string;
  extra_photo_urls: string[];
};

type Result = { ok: boolean; error?: string; id?: string };

async function requireMaster(): Promise<
  { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!isPinnedMasterAdmin(user)) return { ok: false, error: 'Master admin only.' };
  return { ok: true, user };
}

function clean(input: AdminStoryInput) {
  const headline = (input.headline ?? '').trim();
  const rawCategories = (input.categories ?? []).map(String).filter((s) => VALID_SECTIONS.has(s));
  const hasSportsSubcat = rawCategories.some((c) => SPORTS_SUBCATEGORY_SLUGS.has(c));
  const categories =
    hasSportsSubcat && !rawCategories.includes('sports') ? [...rawCategories, 'sports'] : rawCategories;
  return {
    headline,
    subline: (input.subline ?? '').trim() || null,
    byline: (input.byline ?? '').trim() || null,
    body: (input.body ?? '').trim() || null,
    hero_photo_url: (input.hero_photo_url ?? '').trim() || null,
    photo_caption: (input.photo_caption ?? '').trim() || null,
    photo_credit: (input.photo_credit ?? '').trim() || null,
    extra_photo_urls: (input.extra_photo_urls ?? []).map((u) => String(u).trim()).filter(Boolean),
    categories,
  };
}

function friendlyDbError(error: { code?: string; message?: string } | null): string {
  if (isMissingTable(error)) {
    return 'The admin_stories table does not exist yet — run migration 044 in Supabase.';
  }
  return error?.message || 'Database error.';
}

/** Create (id null) or update an Admin Draft. */
export async function saveAdminStory(id: string | null, input: AdminStoryInput): Promise<Result> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const payload = clean(input);
  if (!payload.headline) return { ok: false, error: 'Headline is required.' };

  const supabase = createClient();
  if (id) {
    const { data, error } = await supabase
      .from('admin_stories')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) return { ok: false, error: friendlyDbError(error) || 'Story not found.' };
    revalidatePath(`${BASE}/${id}`);
    revalidatePath(BASE);
    return { ok: true, id };
  }
  const { data, error } = await supabase
    .from('admin_stories')
    .insert({ ...payload, source: 'admin', status: 'admin_draft', created_by: gate.user.id })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: friendlyDbError(error) };
  revalidatePath(BASE);
  return { ok: true, id: data.id as string };
}

/** Save the current form, then copy it into the Story Editor as a draft. */
export async function pushToStoryEditor(id: string | null, input: AdminStoryInput): Promise<Result> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const payload = clean(input);
  if (!payload.headline) return { ok: false, error: 'Headline is required.' };

  const supabase = createClient();

  // Persist the latest edits on the admin row first (create it if new), so
  // the admin bank and the Story Editor draft start identical.
  let adminId = id;
  if (adminId) {
    const { error } = await supabase
      .from('admin_stories')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', adminId);
    if (error) return { ok: false, error: friendlyDbError(error) };
  } else {
    const { data, error } = await supabase
      .from('admin_stories')
      .insert({ ...payload, source: 'admin', status: 'admin_draft', created_by: gate.user.id })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: friendlyDbError(error) };
    adminId = data.id as string;
  }

  // Already pushed? Don't create a second Story Editor draft — point at the
  // existing one (the Story Editor copy is the live one after a push).
  const { data: existing } = await supabase
    .from('admin_stories')
    .select('status, pushed_story_id')
    .eq('id', adminId)
    .maybeSingle();
  if (existing?.status === 'pushed' && existing.pushed_story_id) {
    return {
      ok: false,
      error: 'This story was already pushed to the Story Editor — edit it there.',
      id: existing.pushed_story_id as string,
    };
  }

  const { data: story, error: sErr } = await supabase
    .from('stories')
    .insert({
      headline: payload.headline,
      subline: payload.subline,
      byline: payload.byline ?? gate.user.displayName ?? gate.user.email,
      body: payload.body,
      hero_photo_url: payload.hero_photo_url,
      photo_caption: payload.photo_caption,
      photo_credit: payload.photo_credit,
      extra_photo_urls: payload.extra_photo_urls,
      categories: payload.categories,
      status: 'draft',
      published_at: null,
      author_id: gate.user.id,
    })
    .select('id')
    .single();
  if (sErr || !story) {
    console.error('[pushToStoryEditor] stories insert', sErr);
    return { ok: false, error: sErr?.message || 'Could not create the Story Editor draft.' };
  }

  await supabase
    .from('admin_stories')
    .update({
      status: 'pushed',
      pushed_story_id: story.id,
      pushed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminId);

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${adminId}`);
  revalidatePath('/portal');
  revalidatePath('/portal/all');
  revalidatePath('/portal/all/edit-stories');
  for (const slug of payload.categories) {
    if (ROUTE_SECTION_SLUGS.has(slug)) revalidatePath(`/${slug}`);
  }
  return { ok: true, id: story.id as string };
}

export async function deleteAdminStory(id: string): Promise<Result> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const supabase = createClient();
  const { error } = await supabase.from('admin_stories').delete().eq('id', id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath(BASE);
  return { ok: true };
}

// ── House writing guidelines ────────────────────────────────────────────────

/** Save the house writing guidelines (Master Admin Stories → Writing
 *  Guidelines). Every AI writing path reads the saved text on its next run. */
export async function saveHouseStyle(content: string): Promise<Result> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const text = (content ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, error: 'The guidelines cannot be empty.' };
  const supabase = createClient();
  const { error } = await supabase
    .from('house_style')
    .upsert(
      { key: HOUSE_STYLE_KEY, content: text, updated_at: new Date().toISOString(), updated_by: gate.user.id },
      { onConflict: 'key' }
    );
  if (error) {
    if (/house_style/i.test(error.message) && /could not find|does not exist/i.test(error.message)) {
      return { ok: false, error: 'The house_style table does not exist yet — run migration 045 in Supabase.' };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`${BASE}/guidelines`);
  return { ok: true };
}

// ── AI revision ──────────────────────────────────────────────────────────────

export type ReviseResult =
  | { ok: true; headline: string; subline: string; body: string; model: string }
  | { ok: false; error: string };

const REVISE_SYSTEM_BASE = `You are the copy desk for The South Shore Press, a community newspaper on Long Island's South Shore. You revise an existing article exactly as the publisher instructs.

Rules:
- Apply the publisher's instruction faithfully. Change what the instruction asks you to change and keep everything else intact — same facts, same voice, same structure — unless the instruction says otherwise.
- Never invent facts, names, numbers, dates, or quotes. If the instruction asks for something the article's facts cannot support, do the closest thing the facts allow and keep going.
- Keep AP style and the paper's voice. Body = plain-text paragraphs separated by blank lines; no markdown, no bullet points, no headings.
- Return STRICT JSON and nothing else: {"headline": "...", "subline": "...", "body": "..."}`;

/** Apply the master admin's instruction to the article. Picks the model from
 *  the byline's writer profile (writers.model) when there is one, and folds
 *  that writer's persona in so edits stay in their voice. */
export async function reviseWithAi(input: {
  headline: string;
  subline: string;
  byline: string;
  body: string;
  instruction: string;
}): Promise<ReviseResult> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const instruction = (input.instruction ?? '').trim();
  if (!instruction) return { ok: false, error: 'Type an instruction first.' };
  if (!(input.body ?? '').trim() && !(input.headline ?? '').trim()) {
    return { ok: false, error: 'There is no article text to revise yet.' };
  }

  // Writer persona + model for the byline (optional).
  let persona: string | null = null;
  let model = DEFAULT_MODEL;
  const byline = (input.byline ?? '').trim();
  if (byline) {
    const supabase = createClient();
    const { data: writer } = await supabase
      .from('writers')
      .select('persona, model')
      .eq('name', byline)
      .maybeSingle();
    if (writer) {
      persona = (writer.persona as string | null) ?? null;
      model = ((writer.model as string | null) ?? '').trim() || DEFAULT_MODEL;
    }
  }
  const gateModel = isModelEnabled(model);
  if (!gateModel.ok) return { ok: false, error: gateModel.error! };

  // Persona (the writer's VOICE) first, then the house guidelines, which the
  // preamble subordinates to the voice on conflict.
  const style = await getHouseStyle();
  const system =
    (persona
      ? `${REVISE_SYSTEM_BASE}\n\nThe article's author profile (VOICE) — keep every edit in this voice:\n${persona}`
      : REVISE_SYSTEM_BASE) + houseStyleBlock(style, 'voice');
  const user = `CURRENT ARTICLE
HEADLINE: ${input.headline ?? ''}
SUBHEAD: ${input.subline ?? ''}
BYLINE: ${byline || '(none)'}
BODY:
${input.body ?? ''}

PUBLISHER'S INSTRUCTION:
${instruction}

Return the revised article as JSON now.`;

  const res = await llmComplete({ model, system, user, maxTokens: 6000 });
  if (!res.ok) return { ok: false, error: res.error };
  const cleaned = res.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const obj = JSON.parse(cleaned) as { headline?: string; subline?: string; body?: string };
    const headline = (obj.headline ?? '').trim();
    const body = (obj.body ?? '').trim();
    if (!headline || !body) return { ok: false, error: 'The model returned an unusable revision — try again.' };
    return { ok: true, headline, subline: (obj.subline ?? '').trim(), body, model };
  } catch {
    console.error('[reviseWithAi] unparseable', res.text.slice(0, 300));
    return { ok: false, error: 'The model returned an unusable revision — try again.' };
  }
}
