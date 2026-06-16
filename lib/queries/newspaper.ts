import { createClient } from '@/lib/supabase/server';
import type { NpKind } from '@/lib/newspaper-templates';

export const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';

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

/** Map of page_id → number of items on it (for the board's status line). */
export async function getItemCounts(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('np_items').select('page_id');
  if (error) {
    console.error('[getItemCounts]', error);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { page_id: string }).page_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
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
