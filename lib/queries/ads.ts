import { createClient } from '@/lib/supabase/server';
import { AD_FILES_BUCKET, adFilePublicUrl } from '@/lib/ad-files';

/**
 * Ad Database queries (Phase 8). Advertisers + their copy, and the scheduled
 * print runs with internal invoiced/paid tracking. Ad files (copy + insert
 * orders) live in the public `newspaper-ads` bucket.
 */

// Re-exported for server consumers; client components import from '@/lib/ad-files'.
export { AD_FILES_BUCKET, adFilePublicUrl };

export type Ad = {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  copy_storage_path: string | null;
  copy_file_name: string | null;
  created_at: string;
};

export type AdRun = {
  id: string;
  ad_id: string;
  date_started: string | null;
  num_weeks: number | null;
  price_per_week: number | null;
  page_size: string | null;
  insert_order_path: string | null;
  insert_order_file_name: string | null;
  invoiced: boolean;
  paid: boolean;
  created_at: string;
};

const AD_COLUMNS =
  'id, business_name, contact_name, contact_phone, contact_email, copy_storage_path, copy_file_name, created_at';

/** Every advertiser, newest first. */
export async function getAds(): Promise<Ad[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ads')
    .select(AD_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getAds]', error);
    return [];
  }
  return (data ?? []) as Ad[];
}

/** A single advertiser plus its scheduled runs (reverse-chron). */
export async function getAd(id: string): Promise<{ ad: Ad; runs: AdRun[] } | null> {
  const supabase = createClient();
  const { data: ad, error } = await supabase
    .from('ads')
    .select(AD_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !ad) {
    if (error) console.error('[getAd]', error);
    return null;
  }
  const { data: runs, error: rErr } = await supabase
    .from('ad_runs')
    .select('*')
    .eq('ad_id', id)
    .order('date_started', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (rErr) console.error('[getAd] runs', rErr);
  return { ad: ad as Ad, runs: (runs ?? []) as AdRun[] };
}
