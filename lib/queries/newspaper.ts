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

export type NpPage = {
  id: string;
  page_order: number;
  kind: NpKind;
  title: string;
  section_name: string | null;
  status: NpStatus;
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
  blue_flag?: boolean;
  blue_flag_section?: string;
  author_photo_url?: string;
};

/** Ad payload. */
export type NpAdData = {
  ad_size?: 'full' | 'half' | 'quarter';
  storage_path?: string;
  file_name?: string;
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

/** All pages of the current issue, in order. */
export async function getPages(): Promise<NpPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('np_pages')
    .select('*')
    .order('page_order', { ascending: true });
  if (error) {
    console.error('[getPages]', error);
    return [];
  }
  return (data ?? []) as NpPage[];
}

export type NpItemSummary = { type: 'story' | 'ad'; title: string };

function adSizeWord(size?: string): string {
  return size === 'full' ? 'Full' : size === 'half' ? 'Half' : 'Quarter';
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
