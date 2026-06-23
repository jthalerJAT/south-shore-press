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
  isMaster,
  pageMode,
  templateId,
  type NpKind,
} from '@/lib/newspaper-templates';
import { NEWSPAPER_ADS_BUCKET } from '@/lib/queries/newspaper';
import { NEWSPAPER_IMAGES_BUCKET } from '@/lib/newspaper-images';
import { defaultStoryLayout, defaultAdLayout, type AdSizeValue } from '@/lib/newspaper/layout-engine';
import { normalizeCover, fillSlotFromStory } from '@/lib/newspaper/section-cover';
import { normalizeOpEd, fillOpEdFromStory, fillOpEdAd } from '@/lib/newspaper/oped';
import { normalizePageFour, fillPageFourFromStory, fillPageFourAd } from '@/lib/newspaper/page-four';
import { fillFullAdFromAd, normalizeFullAd } from '@/lib/newspaper/full-ad';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
// Journalists can upload photos for stories they're working on (but not manage
// the issue) — used to gate the shared image-upload action below.
const CONTRIBUTOR_ROLES = ['journalist', 'editor', 'admin', 'master admin'] as const;
const BASE = '/portal/all/newspaper-creator';

type Result = { ok: boolean; error?: string };

/** Coerce an arbitrary stored copy size to a valid ad size (default quarter). */
function normalizeAdSize(size?: string | null): AdSizeValue {
  return size === 'full' || size === 'half' || size === 'third' || size === 'quarter'
    ? size
    : 'quarter';
}

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
    section_name: p.section ?? null,
    template_data: p.colophon ? { show_colophon: true } : {},
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

/** Rebuild the entire page list from DEFAULT_PAGES — DESTRUCTIVE: deletes every
 *  page and its content, then re-seeds the standard 32-page issue skeleton.
 *  For applying a new default structure to the current working issue. */
export async function reseedPages(): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  const { error: delErr } = await supabase.from('np_pages').delete().not('id', 'is', null);
  if (delErr) {
    console.error('[reseedPages] delete', delErr);
    return { ok: false, error: 'Could not clear the existing pages.' };
  }

  const rows = DEFAULT_PAGES.map((p, i) => ({
    page_order: i + 1,
    kind: p.kind,
    title: p.title,
    section_name: p.section ?? null,
    template_data: p.colophon ? { show_colophon: true } : {},
    status: 'tbd',
  }));
  const { error } = await supabase.from('np_pages').insert(rows);
  if (error) {
    console.error('[reseedPages] insert', error);
    return { ok: false, error: 'Could not rebuild the pages.' };
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
    .select('id, kind, template_data')
    .eq('id', pageId)
    .maybeSingle();
  if (!page) return { ok: false, error: 'Page not found.' };

  const story = await getStoryForEdit(sourceStoryId);
  if (!story) return { ok: false, error: 'Story not found.' };

  // Template pages don't take np_items — dropping a story fills the next empty
  // template slot (cover hero/tiles, or the OpEd Main/2nd story).
  if (pageMode(page.kind) === 'template') {
    const tid = templateId(page.kind);
    const data =
      tid === 'oped'
        ? fillOpEdFromStory(normalizeOpEd(page.template_data), story)
        : tid === 'page_four'
        ? fillPageFourFromStory(normalizePageFour(page.template_data), story)
        : fillSlotFromStory(normalizeCover(page.template_data, page.kind), story);
    const { error } = await supabase
      .from('np_pages')
      .update({ template_data: data, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', pageId);
    if (error) {
      console.error('[addStoryToPage:template]', error);
      return { ok: false, error: 'Could not add story to the page.' };
    }
    revalidatePath(BASE);
    revalidatePath(`${BASE}/${pageId}`);
    return { ok: true };
  }

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

/** Board drag: add an ad block (from the Ad Database) to a flow page. */
export async function addAdToPage(pageId: string, adId: string): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  const { data: page } = await supabase
    .from('np_pages')
    .select('id, kind, template_data')
    .eq('id', pageId)
    .maybeSingle();
  if (!page) return { ok: false, error: 'Page not found.' };

  const { data: ad } = await supabase
    .from('ads')
    .select(
      'business_name, contact_name, contact_phone, contact_email, copy_storage_path, copy_file_name, copy_size'
    )
    .eq('id', adId)
    .maybeSingle();
  if (!ad) return { ok: false, error: 'Ad not found.' };

  // The ad's own Copy Size drives how big it lands on the page (default
  // quarter when unset). Editors can still override per-placement.
  const adSize = normalizeAdSize((ad as { copy_size?: string }).copy_size);

  // Template pages take the ad into their template_data, not np_items.
  if (pageMode(page.kind) === 'template') {
    const tid = templateId(page.kind);
    let data: Record<string, unknown> | null = null;
    if (tid === 'oped') {
      data = fillOpEdAd(normalizeOpEd(page.template_data), {
        id: adId,
        copy_storage_path: ad.copy_storage_path,
        copy_file_name: ad.copy_file_name,
      }) as unknown as Record<string, unknown>;
    } else if (tid === 'page_four') {
      data = fillPageFourAd(normalizePageFour(page.template_data), {
        id: adId,
        copy_storage_path: ad.copy_storage_path,
        copy_file_name: ad.copy_file_name,
      }) as unknown as Record<string, unknown>;
    } else if (tid === 'full_ad') {
      const a = ad as {
        business_name?: string | null;
        contact_name?: string | null;
        contact_phone?: string | null;
        contact_email?: string | null;
        copy_storage_path?: string | null;
        copy_file_name?: string | null;
        copy_size?: string | null;
      };
      data = fillFullAdFromAd(normalizeFullAd(page.template_data), {
        id: adId,
        business_name: a.business_name,
        contact_name: a.contact_name,
        contact_phone: a.contact_phone,
        contact_email: a.contact_email,
        copy_storage_path: a.copy_storage_path,
        copy_file_name: a.copy_file_name,
        copy_size: a.copy_size,
      }) as unknown as Record<string, unknown>;
    } else {
      return { ok: false, error: 'This template page has no ad slot.' };
    }
    const { error } = await supabase
      .from('np_pages')
      .update({ template_data: data, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', pageId);
    if (error) {
      console.error('[addAdToPage:template]', error);
      return { ok: false, error: 'Could not add the ad.' };
    }
    revalidatePath(BASE);
    revalidatePath(`${BASE}/${pageId}`);
    return { ok: true };
  }

  const { data: items } = await supabase
    .from('np_items')
    .select('item_order')
    .eq('page_id', pageId);
  const maxOrder = (items ?? []).reduce(
    (m, r) => Math.max(m, (r as { item_order: number }).item_order),
    -1
  );
  const bandIndex = maxOrder + 1;

  const { error } = await supabase.from('np_items').insert({
    page_id: pageId,
    slot_key: null,
    item_order: bandIndex,
    type: 'ad',
    source_story_id: null,
    data: {
      ad_size: adSize,
      storage_path: ad.copy_storage_path ?? '',
      file_name: ad.copy_file_name ?? '',
      ad_id: adId,
    },
    layout: defaultAdLayout(bandIndex, adSize),
  });
  if (error) {
    console.error('[addAdToPage]', error);
    return { ok: false, error: 'Could not add the ad.' };
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

/** Persist a template page's section-cover fields and lock it. */
export async function saveCover(
  pageId: string,
  data: Record<string, unknown>
): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { error } = await supabase
    .from('np_pages')
    .update({ template_data: data, status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[saveCover]', error);
    return { ok: false, error: 'Could not save the page.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Toggle the standing publication-info rail (colophon) on a flow page. Stored
 *  in the page's template_data so flow pages need no extra column. */
export async function setColophonRail(pageId: string, show: boolean): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { data: page } = await supabase
    .from('np_pages')
    .select('template_data')
    .eq('id', pageId)
    .maybeSingle();
  const td = { ...((page?.template_data as Record<string, unknown>) ?? {}), show_colophon: show };
  const { error } = await supabase
    .from('np_pages')
    .update({ template_data: td, updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[setColophonRail]', error);
    return { ok: false, error: 'Could not update the page.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Toggle whether a page is included in the printed issue. */
export async function setPageIncluded(pageId: string, included: boolean): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { error } = await supabase
    .from('np_pages')
    .update({ include_in_paper: included, updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[setPageIncluded]', error);
    return { ok: false, error: 'Could not update the page.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Signed upload URL for an editorial photo (browser → Storage, newspaper-images
 *  bucket). Available to journalists too — they add photos to their own stories. */
export async function requestImageUploadUrl(
  fileName: string
): Promise<{ ok: boolean; error?: string; path?: string; token?: string }> {
  await requireRole([...CONTRIBUTOR_ROLES], BASE);
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
    .from(NEWSPAPER_IMAGES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestImageUploadUrl]', error);
    return { ok: false, error: 'Could not start the upload. Is the `newspaper-images` bucket created?' };
  }
  return { ok: true, path, token: data.token };
}

/** Fetch a story's full detail (incl. body) so an editor picker can fill all
 *  fields — the board-side story list omits the body for payload size. */
export async function fetchStoryDetail(
  id: string
): Promise<{
  headline: string;
  byline: string;
  body: string;
  hero_photo_url: string;
  photo_caption: string;
  photo_credit: string;
} | null> {
  await requireRole([...EDITOR_ROLES], BASE);
  const s = await getStoryForEdit(id);
  if (!s) return null;
  return {
    headline: s.headline ?? '',
    byline: s.byline ?? '',
    body: s.body ?? '',
    hero_photo_url: s.hero_photo_url ?? '',
    photo_caption: s.photo_caption ?? '',
    photo_credit: s.photo_credit ?? '',
  };
}

/** Persist a full-page-ad template page's fields and lock it. */
export async function saveFullAd(pageId: string, data: Record<string, unknown>): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { error } = await supabase
    .from('np_pages')
    .update({ template_data: data, status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[saveFullAd]', error);
    return { ok: false, error: 'Could not save the page.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Persist a Page 4 (Op-Ed Page) template page's fields and lock it. */
export async function savePageFour(pageId: string, data: Record<string, unknown>): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { error } = await supabase
    .from('np_pages')
    .update({ template_data: data, status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[savePageFour]', error);
    return { ok: false, error: 'Could not save the page.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Change a page's template kind (e.g. convert a blank flow page into the
 *  Op-Ed Page template). Resets the page to 'tbd' since the new renderer reads
 *  a different content shape; existing content rows are left in place but
 *  unused by the new template. */
export async function setPageKind(pageId: string, kind: NpKind): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { error } = await supabase
    .from('np_pages')
    .update({ kind, status: 'tbd', updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[setPageKind]', error);
    return { ok: false, error: 'Could not change the page type.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Persist a Page 2 (OpEd) template page's fields and lock it. */
export async function saveOpEd(pageId: string, data: Record<string, unknown>): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  const { error } = await supabase
    .from('np_pages')
    .update({ template_data: data, status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) {
    console.error('[saveOpEd]', error);
    return { ok: false, error: 'Could not save the page.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${pageId}`);
  return { ok: true };
}

/** Reorder the issue's pages to the given id order (1-based page_order). */
export async function reorderPages(orderedIds: string[]): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('np_pages').update({ page_order: i + 1 }).eq('id', id)
    )
  );
  revalidatePath(BASE);
  return { ok: true };
}

/** Delete a page (and its content, via FK cascade). Refused for master pages. */
export async function deletePage(pageId: string): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  const { data: page } = await supabase
    .from('np_pages')
    .select('id, kind')
    .eq('id', pageId)
    .maybeSingle();
  if (!page) return { ok: false, error: 'Page not found.' };
  if (isMaster(page.kind)) {
    return { ok: false, error: 'This is a master page and can’t be deleted.' };
  }

  const { error } = await supabase.from('np_pages').delete().eq('id', pageId);
  if (error) {
    console.error('[deletePage]', error);
    return { ok: false, error: 'Could not delete the page.' };
  }

  // Renumber the remaining pages so page_order stays contiguous.
  const { data: rest } = await supabase
    .from('np_pages')
    .select('id')
    .order('page_order', { ascending: true });
  await Promise.all(
    (rest ?? []).map((p, i) =>
      supabase.from('np_pages').update({ page_order: i + 1 }).eq('id', (p as { id: string }).id)
    )
  );
  revalidatePath(BASE);
  return { ok: true };
}

/** Clear all content + template fields for every page, but keep the page list
 *  and order intact (the "Reset Content" button). */
export async function resetIssueContent(): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const supabase = createClient();

  // Remove flow content (leave any continuation rows for Phase 2B alone).
  const { error: delErr } = await supabase
    .from('np_items')
    .delete()
    .is('continuation_group', null)
    .not('id', 'is', null);
  if (delErr) {
    console.error('[resetIssueContent] items', delErr);
    return { ok: false, error: 'Could not clear page content.' };
  }

  const { error: pErr } = await supabase
    .from('np_pages')
    .update({ template_data: {}, section_name: null, status: 'tbd', updated_at: new Date().toISOString() })
    .not('id', 'is', null);
  if (pErr) {
    console.error('[resetIssueContent] pages', pErr);
    return { ok: false, error: 'Cleared content, but could not reset page status.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Insert a standard template page (e.g. a Sports Cover) at the end. */
export async function addStandardPage(kind: NpKind): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  if (pageMode(kind) !== 'template') {
    return { ok: false, error: 'Not an addable standard page.' };
  }
  const supabase = createClient();
  const { data: pages } = await supabase
    .from('np_pages')
    .select('page_order')
    .order('page_order', { ascending: false })
    .limit(1);
  const nextOrder = ((pages?.[0] as { page_order: number } | undefined)?.page_order ?? 0) + 1;

  const { error } = await supabase.from('np_pages').insert({
    page_order: nextOrder,
    kind,
    title: templateFor(kind).label,
    status: 'tbd',
  });
  if (error) {
    console.error('[addStandardPage]', error);
    return { ok: false, error: 'Could not add the page.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}
