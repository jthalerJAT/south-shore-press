import { createClient } from '@/lib/supabase/server';
import type { NpKind } from '@/lib/newspaper-templates';
import type {
  StoredStoryLayout,
  StoredAdLayout,
  StoredLayout,
} from '@/lib/newspaper/layout-engine';

export const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';

// Re-exported so the Newspaper Creator UI can import layout types from one place.
export type { StoredStoryLayout, StoredAdLayout, StoredLayout };

export type NpStatus = 'tbd' | 'draft' | 'locked';

/** Which of the two coexisting issues a page belongs to: the standard weekly
 *  book or the Election Issue special (2026-10-07). The board's toggle flips
 *  the ACTIVE variant (np_settings.active_variant); both page sets persist. */
export type IssueVariant = 'standard' | 'election';

export type NpPage = {
  id: string;
  page_order: number;
  kind: NpKind;
  title: string;
  section_name: string | null;
  status: NpStatus;
  /** Issue the page belongs to. Optional so reads keep working before
   *  migration 050; absent means 'standard'. */
  variant?: IssueVariant;
  /** Structured fields for template-mode pages (Front Page, section covers).
   *  Empty object `{}` for flow pages / before Phase 6. */
  template_data: Record<string, unknown>;
  /** Whether this page is part of the printed issue (drives View File + the
   *  whole-issue press-PDF export). Defaults true. */
  include_in_paper: boolean;
  created_at: string;
  updated_at: string;
};

/** Story snapshot payload (independent print copy). */
export type NpStoryData = {
  headline?: string;
  subline?: string;
  byline?: string;
  body?: string;
  hero_photo_url?: string;
  extra_photo_urls?: string[];
  photo_caption?: string;
  photo_credit?: string;
  blue_flag?: boolean;
  blue_flag_section?: string;
  author_photo_url?: string;
};

/** Ad payload. */
export type NpAdData = {
  ad_size?: 'full' | 'half' | 'third' | 'quarter';
  storage_path?: string;
  file_name?: string;
  ad_id?: string;
};

export type NpItem = {
  id: string;
  page_id: string;
  slot_key: string | null;
  item_order: number;
  type: 'story' | 'ad';
  source_story_id: string | null;
  data: NpStoryData & NpAdData;
  /** Phase 2 visual-layout geometry (raw jsonb; normalise via the engine).
   *  Empty object `{}` for rows created before Phase 2 or never laid out. */
  layout: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Which issue the Newspaper Creator is currently showing. Falls back to
 *  'standard' when migration 050 hasn't been applied yet. */
export async function getActiveVariant(): Promise<IssueVariant> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('np_settings')
    .select('value')
    .eq('key', 'active_variant')
    .maybeSingle();
  if (error || !data) return 'standard';
  return data.value === 'election' ? 'election' : 'standard';
}

/** Rows are filtered in JS (not SQL) so reads keep working before migration
 *  050 adds the variant column — absent variant counts as 'standard'. */
export function pageInVariant(p: { variant?: string | null }, variant: IssueVariant): boolean {
  return (p.variant ?? 'standard') === variant;
}

/** All pages of an issue, in order. Defaults to the ACTIVE variant. */
export async function getPages(variant?: IssueVariant): Promise<NpPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('np_pages')
    .select('*')
    .order('page_order', { ascending: true });
  if (error) {
    console.error('[getPages]', error);
    return [];
  }
  const v = variant ?? (await getActiveVariant());
  return ((data ?? []) as NpPage[]).filter((p) => pageInVariant(p, v));
}

export type NpItemSummary = { type: 'story' | 'ad'; title: string };

function adSizeWord(size?: string): string {
  return size === 'full'
    ? 'Full'
    : size === 'half'
    ? 'Half'
    : size === 'third'
    ? 'One-Third'
    : 'Quarter';
}

/** Map of page_id → the content titles on it (story headlines + "{Size} Page
 *  Ad"), in item order — shown under each page title on the board. */
export async function getItemSummaries(): Promise<Record<string, NpItemSummary[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('np_items')
    .select('page_id, item_order, type, data')
    .order('item_order', { ascending: true });
  if (error) {
    console.error('[getItemSummaries]', error);
    return {};
  }
  const map: Record<string, NpItemSummary[]> = {};
  for (const row of data ?? []) {
    const r = row as { page_id: string; type: 'story' | 'ad'; data: NpStoryData & NpAdData };
    const title =
      r.type === 'ad'
        ? `${adSizeWord(r.data?.ad_size)} Page Ad`
        : String(r.data?.headline ?? '').trim() || 'Untitled story';
    (map[r.page_id] ??= []).push({ type: r.type, title });
  }
  return map;
}

/** The issue date typed on the Front Page (its template_data.issue_date).
 *  Later pages display it in their running head. Each variant has its own
 *  front page, so this follows the active (or given) variant. */
export async function getIssueDate(variant?: IssueVariant): Promise<string> {
  const supabase = createClient();
  // select('*') rather than naming the variant column, so this read keeps
  // working before migration 050.
  const { data } = await supabase.from('np_pages').select('*').eq('kind', 'front');
  const v = variant ?? (await getActiveVariant());
  const front = ((data ?? []) as Array<{ template_data: unknown; variant?: string | null }>).find(
    (p) => pageInVariant(p, v)
  );
  const td = (front?.template_data ?? {}) as { issue_date?: string };
  return td.issue_date ?? '';
}

export async function getPage(pageId: string): Promise<NpPage | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('np_pages')
    .select('*')
    .eq('id', pageId)
    .maybeSingle();
  if (error) {
    console.error('[getPage]', error);
    return null;
  }
  return (data ?? null) as NpPage | null;
}

export async function getPageItems(pageId: string): Promise<NpItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('np_items')
    .select('*')
    .eq('page_id', pageId)
    .order('item_order', { ascending: true });
  if (error) {
    console.error('[getPageItems]', error);
    return [];
  }
  return (data ?? []) as NpItem[];
}

/** Public URL for an uploaded ad creative (the bucket is public). */
export function adPublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${NEWSPAPER_ADS_BUCKET}/${storagePath}`;
}
