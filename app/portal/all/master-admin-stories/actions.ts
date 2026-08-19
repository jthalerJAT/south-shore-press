'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, isPinnedMasterAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { llmComplete, isModelEnabled, DEFAULT_MODEL } from '@/lib/llm';
import { SITE_SECTIONS, SPORTS_SUBCATEGORIES, PRINT_ONLY_SLUG } from '@/lib/site-config';
import { isMissingTable, isMissingAiThread, type AiTurn } from '@/lib/queries/admin-stories';
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

type Result = { ok: boolean; error?: string; id?: string; adminId?: string };

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

/** Sanitize a client-supplied AI thread before storing it. */
function cleanThread(thread: AiTurn[] | undefined | null): AiTurn[] {
  if (!Array.isArray(thread)) return [];
  return thread
    .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    .slice(-60)
    .map((t) => ({
      role: t.role,
      text: String(t.text).slice(0, 8000),
      at: typeof t.at === 'string' ? t.at : new Date().toISOString(),
      ...(t.role === 'assistant' && t.applied ? { applied: true } : {}),
    }));
}

/** Create (id null) or update an Admin Draft. The AI conversation is saved
 *  alongside (migration 046); pre-046 the save silently drops it. */
export async function saveAdminStory(
  id: string | null,
  input: AdminStoryInput,
  thread?: AiTurn[]
): Promise<Result> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const payload = clean(input);
  if (!payload.headline) return { ok: false, error: 'Headline is required.' };
  const ai_thread = cleanThread(thread);

  const supabase = createClient();
  if (id) {
    let { data, error } = await supabase
      .from('admin_stories')
      .update({ ...payload, ai_thread, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error && isMissingAiThread(error)) {
      ({ data, error } = await supabase
        .from('admin_stories')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .maybeSingle());
    }
    if (error || !data) return { ok: false, error: friendlyDbError(error) || 'Story not found.' };
    revalidatePath(`${BASE}/${id}`);
    revalidatePath(BASE);
    return { ok: true, id };
  }
  let { data, error } = await supabase
    .from('admin_stories')
    .insert({ ...payload, ai_thread, source: 'admin', status: 'admin_draft', created_by: gate.user.id })
    .select('id')
    .single();
  if (error && isMissingAiThread(error)) {
    ({ data, error } = await supabase
      .from('admin_stories')
      .insert({ ...payload, source: 'admin', status: 'admin_draft', created_by: gate.user.id })
      .select('id')
      .single());
  }
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

  // Mark pushed and dispose of the AI conversation (it belonged to the
  // drafting stage). Pre-046 the column is absent — retry without it.
  const pushedPatch = {
    status: 'pushed',
    pushed_story_id: story.id,
    pushed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error: pErr } = await supabase
    .from('admin_stories')
    .update({ ...pushedPatch, ai_thread: [] })
    .eq('id', adminId);
  if (pErr && isMissingAiThread(pErr)) {
    await supabase.from('admin_stories').update(pushedPatch).eq('id', adminId);
  }

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${adminId}`);
  revalidatePath('/portal');
  revalidatePath('/portal/all');
  revalidatePath('/portal/all/edit-stories');
  for (const slug of payload.categories) {
    if (ROUTE_SECTION_SLUGS.has(slug)) revalidatePath(`/${slug}`);
  }
  return { ok: true, id: story.id as string, adminId };
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

// ── AI conversation ─────────────────────────────────────────────────────────

export type AskAiResult =
  | {
      ok: true;
      /** The assistant's visible reply — an answer, or an explanation of the edit. */
      reply: string;
      /** Present only when the publisher asked for a change to the text. */
      edit: { headline: string; subline: string; body: string } | null;
      model: string;
    }
  | { ok: false; error: string };

const ASK_SYSTEM_BASE = `You are the publisher's editorial assistant and copy desk at The South Shore Press, a community newspaper on Long Island's South Shore. You are in a running conversation with the publisher about ONE article (shown below, always in its current state).

The publisher will send two kinds of messages. Tell them apart:
- A QUESTION or request for judgment ("is this quote dual-sourced?", "is the lede too long?", "what's weak here?"). ANSWER it in "reply". Do NOT change the article. Set "edit" to null.
- An EDIT INSTRUCTION ("tighten the lede", "cut the second quote", "add a paragraph on…"). Make the change AND, in "reply", explain concisely what you changed and why — so the publisher can see your reasoning, not just the result.
If a message is ambiguous, answer the question and propose the edit rather than silently making it.

What you know and don't know:
- You know ONLY the article text and this conversation. You have NO access to the sources, the wire, the web, or the reporter's notes. If asked to verify sourcing, facts, attribution, or a quote, say plainly that you cannot verify it from here, explain what you CAN observe in the text (e.g. whether the quote is attributed and to whom), and say what the publisher should check. NEVER delete or alter material on the grounds that you could not verify it unless the publisher explicitly tells you to.
- Never invent facts, names, numbers, dates, or quotes. If an instruction asks for something the article's facts cannot support, do the closest thing the facts allow and say so in "reply".

Editing rules (when you do edit):
- Change what was asked and keep everything else intact — same facts, same voice, same structure — unless told otherwise.
- Keep AP style and the paper's voice. Body = plain-text paragraphs separated by blank lines; no markdown, no bullets, no headings.

Output: STRICT JSON and nothing else:
{"reply": "...", "edit": null}
or
{"reply": "...", "edit": {"headline": "...", "subline": "...", "body": "..."}}
"reply" is plain text (a few sentences; longer if a question needs it). In "edit", return the COMPLETE headline, subline and body — not a diff.`;

const MAX_HISTORY_TURNS = 14;

/** One turn of the AI conversation about an admin story. Answers questions;
 *  applies and explains edits. The byline's writer persona (VOICE) and model
 *  are used when the byline is a house writer, then the house guidelines. */
export async function askAi(input: {
  headline: string;
  subline: string;
  byline: string;
  body: string;
  message: string;
  history: AiTurn[];
}): Promise<AskAiResult> {
  const gate = await requireMaster();
  if (!gate.ok) return { ok: false, error: gate.error };
  const message = (input.message ?? '').trim();
  if (!message) return { ok: false, error: 'Type a message first.' };
  if (!(input.body ?? '').trim() && !(input.headline ?? '').trim()) {
    return { ok: false, error: 'There is no article text yet.' };
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

  const style = await getHouseStyle();
  const system =
    (persona
      ? `${ASK_SYSTEM_BASE}\n\nThe article's author profile (VOICE) — keep every edit in this voice:\n${persona}`
      : ASK_SYSTEM_BASE) + houseStyleBlock(style, 'voice');

  const history = cleanThread(input.history).slice(-MAX_HISTORY_TURNS);
  const transcript = history.length
    ? history
        .map((t) => `${t.role === 'user' ? 'PUBLISHER' : 'ASSISTANT'}${t.applied ? ' (applied an edit)' : ''}: ${t.text}`)
        .join('\n\n')
    : '(none yet)';

  const user = `CURRENT ARTICLE (as it stands right now, including any edits already applied)
HEADLINE: ${input.headline ?? ''}
SUBHEAD: ${input.subline ?? ''}
BYLINE: ${byline || '(none)'}
BODY:
${input.body ?? ''}

CONVERSATION SO FAR:
${transcript}

PUBLISHER'S NEW MESSAGE:
${message}

Respond as JSON now.`;

  const res = await llmComplete({ model, system, user, maxTokens: 6000 });
  if (!res.ok) return { ok: false, error: res.error };
  const cleaned = res.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const obj = JSON.parse(cleaned) as {
      reply?: string;
      edit?: { headline?: string; subline?: string; body?: string } | null;
    };
    const reply = (obj.reply ?? '').trim();
    let edit: { headline: string; subline: string; body: string } | null = null;
    if (obj.edit && typeof obj.edit === 'object') {
      const headline = (obj.edit.headline ?? '').trim();
      const body = (obj.edit.body ?? '').trim();
      if (headline && body) edit = { headline, subline: (obj.edit.subline ?? '').trim(), body };
    }
    if (!reply && !edit) return { ok: false, error: 'The model returned an unusable reply — try again.' };
    return { ok: true, reply: reply || 'Done.', edit, model };
  } catch {
    // Not JSON — treat the whole thing as a plain reply rather than failing.
    const text = res.text.trim();
    if (text) return { ok: true, reply: text.slice(0, 4000), edit: null, model };
    console.error('[askAi] unparseable', res.text.slice(0, 300));
    return { ok: false, error: 'The model returned an unusable reply — try again.' };
  }
}
