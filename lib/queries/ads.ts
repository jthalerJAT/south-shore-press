import { createClient } from '@/lib/supabase/server';
import { AD_FILES_BUCKET, adFilePublicUrl } from '@/lib/ad-files';

/**
 * Ad-copy queries for the newspaper creator (Ad Database v2, migration 039).
 *
 * Since the client/file split, "an ad you can place on a page" means ONE COPY
 * FILE belonging to a client. `getAds()` therefore returns one row per copy
 * file, joined with its client's identity. The historical `Ad` field names
 * (business_name, copy_storage_path, copy_file_name, copy_size) are kept so
 * the placement pipeline and its snapshots are unchanged — but `id` is now an
 * `ad_files` id, and `addAdToPage` resolves it against ad_files.
 */

// Re-exported for server consumers; client components import from '@/lib/ad-files'.
export { AD_FILES_BUCKET, adFilePublicUrl };

export type Ad = {
  /** ad_files.id of the copy file. */
  id: string;
  /** The owning client's id (ad_clients). */
  client_id: string;
  business_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  copy_storage_path: string | null;
  copy_file_name: string | null;
  /** Size the copy is designed for; drives placement size on a page. */
  copy_size: string | null;
  /** When the copy file was uploaded. */
  created_at: string;
};

type CopyRow = {
  id: string;
  client_id: string;
  storage_path: string;
  file_name: string | null;
  copy_size: string | null;
  created_at: string;
  client: {
    business_name: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  } | null;
};

function toAd(r: CopyRow): Ad {
  return {
    id: r.id,
    client_id: r.client_id,
    business_name: r.client?.business_name ?? '(unknown client)',
    contact_name: r.client?.contact_name ?? null,
    contact_phone: r.client?.contact_phone ?? null,
    contact_email: r.client?.contact_email ?? null,
    copy_storage_path: r.storage_path,
    copy_file_name: r.file_name,
    copy_size: r.copy_size,
    created_at: r.created_at,
  };
}

const COPY_SELECT =
  'id, client_id, storage_path, file_name, copy_size, created_at, client:ad_clients!ad_files_client_id_fkey(business_name, contact_name, contact_phone, contact_email)';

/** Every placeable copy file, grouped client-alphabetical then newest first. */
export async function getAds(): Promise<Ad[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ad_files')
    .select(COPY_SELECT)
    .eq('kind', 'copy')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getAds]', error);
    return [];
  }
  // postgrest types FK joins as arrays; runtime is a single object (see HANDOFF).
  const rows = (data ?? []) as unknown as CopyRow[];
  return rows
    .map(toAd)
    .sort(
      (a, b) =>
        a.business_name.localeCompare(b.business_name, 'en', { sensitivity: 'base' }) ||
        b.created_at.localeCompare(a.created_at)
    );
}

/** One placeable copy file by ad_files id (placement lookups). */
export async function getAdCopy(fileId: string): Promise<Ad | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ad_files')
    .select(COPY_SELECT)
    .eq('id', fileId)
    .eq('kind', 'copy')
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[getAdCopy]', error);
    return null;
  }
  return toAd(data as unknown as CopyRow);
}
