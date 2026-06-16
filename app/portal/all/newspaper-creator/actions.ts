'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStoryForEdit } from '@/lib/queries/editor-stories';
import {
  DEFAULT_PAGES,
  templateFor,
  isOpenKind,
  type NpKind,
} from '@/lib/newspaper-templates';
import { NEWSPAPER_ADS_BUCKET } from '@/lib/queries/newspaper';
import { defaultStoryLayout } from '@/lib/newspaper/layout-engine';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
const BASE = '/portal/all/newspaper-creator';

type Result = { ok: boolean; error?: string };

/** Seed the default pages once, on first visit (idempotent — no-op if any
 *  pages already exist). */
export async function seedDefaultPages(): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { count, error: cErr } = await supabase
    .from('np_pages')
    .select('id', { count: 'exact', head: true });
  if (cErr) return { ok: false, error: 'Could not read pages.' };
  if ((count ?? 0) > 0) return { ok: true };

  const rows = DEFAULT_PAGES.map((p, i) => ({
    page_order: i + 1,
    kind: p.kind,
    title: p.title,
    status: 'tbd',
  }));
  const { error } = await supabase.from('np_pages').insert(rows);
  if (error) {
    console.error('[seedDefaultPages]', error);
    return { ok: false, error: 'Could not seed pages.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Board drag: add an INDEPENDENT print snapshot of a website story to a
 *  page (next empty named slot, or appended for open pages). */
export async function addStoryToPage(
  pageId: string,
  sourceStoryId: string
): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  const { data: page } = await supabase
    .from('np_pages')
    .select('id, kind')
    .eq('id', pageId)
    .maybeSingle();
  if (!page) return { ok: false, error: 'Page not found.' };

  const story = await getStoryForEdit(sourceStoryId);
  if (!story) return { ok: false, error: 'Story not found.' };

  const { data: items } = await supabase
    .from('np_items')
    .select('slot_key, item_order')
    .eq('page_id', pageId);
  const existing = items ?? [];
  const maxOrder = existing.reduce(
    (m, r) => Math.max(m, (r as { item_order: number }).item_order),
    -1
  );

  // Pick the next empty named slot, or null for open pages.
  let slotKey: string | null = null;
  if (!isOpenKind(page.kind as NpKind)) {
    const used = new Set(
      existing.map((r) => (r as { slot_key: string | null }).slot_key)
    );
    const tmpl = templateFor(page.kind);
    if (Array.isArray(tmpl.slots)) {
      const open = tmpl.slots.find((s) => !used.has(s.key));
      slotKey = open?.key ?? null;
    }
  }

  const bandIndex = maxOrder + 1;
  const { error } = await supabase.from('np_items').insert({
    page_id: pageId,
    slot_key: slotKey,
    item_order: bandIndex,
    type: 'story',
    source_story_id: sourceStoryId,
    data: {
      headline: story.headline ?? '',
      subline: story.subline ?? '',
      byline: story.byline ?? '',
      body: story.body ?? '',
      hero_photo_url: story.hero_photo_url ?? '',
      extra_photo_urls: story.extra_photo_urls ?? [],
    },
    // Seed a sensible default layout so the story renders in the visual
    // editor before it's touched: 4 columns, photo top-aligned in cols 2–3
    // (only if the story actually has a hero photo).
    layout: defaultStoryLayout(bandIndex, Boolean(story.hero_photo_url)),
  });
  if (error) {
    console.error('[addStoryToPage]', error);
    return { ok: false, error: 'Could not add story.' };
  }

  await supabase
    .from('np_pages')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', pageId)
    .eq('status', 'tbd');

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Insert a new generic ("Page N") page into the front-matter run — after
 *  the last front-matter page (front/page2/generic), before the first
 *  themed section. */
export async function addPage(): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  const { data: pages } = await supabase
    .from('np_pages')
    .select('id, kind, page_order')
    .order('page_order', { ascending: true });

  const frontMatter = new Set<NpKind>(['front', 'page2', 'generic']);
  const list = (pages ?? []) as Array<{ kind: NpKind; page_order: number }>;
  const firstThemed = list.find((p) => !frontMatter.has(p.kind));
  const insertOrder = firstThemed ? firstThemed.page_order : list.length + 1;

  // Shift everything at/after the insertion point down by one.
  for (const p of list) {
    if (p.page_order >= insertOrder) {
      await supabase
        .from('np_pages')
        .update({ page_order: p.page_order + 1 })
        .eq('id', (p as unknown as { id: string }).id);
    }
  }

  const { error } = await supabase.from('np_pages').insert({
    page_order: insertOrder,
    kind: 'generic',
    title: 'Page',
    status: 'tbd',
  });
  if (error) {
    console.error('[addPage]', error);
    return { ok: false, error: 'Could not add page.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Editor-gated signed upload URL for an ad creative (browser → Storage). */
export async function requestAdUploadUrl(
  fileName: string
): Promise<{ ok: boolean; error?: string; path?: string; token?: string }> {
  await requireRole([...EDITOR_ROLES], BASE);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Uploads are not configured on this deployment.' };
  }
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
  const path = `${randomUUID()}${ext}`;
  const { data, error } = await admin.storage
    .from(NEWSPAPER_ADS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestAdUploadUrl]', error);
    return { ok: false, error: 'Could not start the upload. Is the `newspaper-ads` bucket created?' };
  }
  return { ok: true, path, token: data.token };
}

export type SavedItem = {
  type: 'story' | 'ad';
  slot_key: string | null;
  source_story_id: string | null;
  data: Record<string, unknown>;
  /** Phase 2 visual-layout geometry. Omitted by the form editor (resets to
   *  default on next layout open); sent by the visual layout editor. */
  layout?: Record<string, unknown>;
};

/** Save (replace) all content for a page and LOCK it. The editor manages the
 *  full item list locally and sends it whole — simplest, race-free persistence.
 *  Delete is scoped to non-continuation rows so a future multi-page story
 *  (Phase 2B) isn't orphaned by saving one of its pages. */
export async function savePage(
  pageId: string,
  sectionName: string,
  items: SavedItem[]
): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  const { data: page } = await supabase
    .from('np_pages')
    .select('id')
    .eq('id', pageId)
    .maybeSingle();
  if (!page) return { ok: false, error: 'Page not found.' };

  const { error: delErr } = await supabase
    .from('np_items')
    .delete()
    .eq('page_id', pageId)
    .is('continuation_group', null);
  if (delErr) {
    console.error('[savePage] delete', delErr);
    return { ok: false, error: 'Could not save (clearing old content).' };
  }

  if (items.length > 0) {
    const rows = items.map((it, i) => ({
      page_id: pageId,
      slot_key: it.slot_key ?? null,
      item_order: i,
      type: it.type,
      source_story_id: it.source_story_id ?? null,
      data: it.data ?? {},
      layout: it.layout ?? {},
    }));
    const { error: insErr } = await supabase.from('np_items').insert(rows);
    if (insErr) {
      console.error('[savePage] insert', insErr);
      return { ok: false, error: 'Could not save the page content.' };
    }
  }

  const status = items.length > 0 ? 'locked' : 'tbd';
  const { error: pErr } = await supabase
    .from('np_pages')
    .update({
      section_name: sectionName.trim() || null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pageId);
  if (pErr) {
    console.error('[savePage] page', pErr);
    return { ok: false, error: 'Saved content, but could not lock the page.' };
  }

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}
