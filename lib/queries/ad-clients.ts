import { createClient } from '@/lib/supabase/server';

/**
 * Ad Database v2 queries — clients + their files (migration 039).
 * The Ad Database page lists clients alphabetically; each client holds three
 * "folders" of files: ad copy (with a size designation), insert orders, and
 * contracts. Files live in the public `newspaper-ads` bucket.
 */

export type AdFileKind = 'copy' | 'insert_order' | 'contract';

export type AdClient = {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
};

export type AdClientFile = {
  id: string;
  client_id: string;
  kind: AdFileKind;
  storage_path: string;
  file_name: string | null;
  /** Size the copy is designed for (copy files only). */
  copy_size: string | null;
  created_at: string;
};

export type AdClientWithCounts = AdClient & {
  copy_count: number;
  insert_order_count: number;
  contract_count: number;
};

const CLIENT_COLUMNS =
  'id, business_name, contact_name, contact_phone, contact_email, created_at';
const FILE_COLUMNS = 'id, client_id, kind, storage_path, file_name, copy_size, created_at';

/** Every client, alphabetical, with per-folder file counts. */
export async function getAdClients(): Promise<AdClientWithCounts[]> {
  const supabase = createClient();
  const [{ data: clients, error }, { data: files, error: fErr }] = await Promise.all([
    supabase.from('ad_clients').select(CLIENT_COLUMNS).order('business_name'),
    supabase.from('ad_files').select('client_id, kind'),
  ]);
  if (error) {
    console.error('[getAdClients]', error);
    return [];
  }
  if (fErr) console.error('[getAdClients] files', fErr);

  const counts = new Map<string, { copy: number; insert_order: number; contract: number }>();
  for (const f of (files ?? []) as { client_id: string; kind: AdFileKind }[]) {
    const c = counts.get(f.client_id) ?? { copy: 0, insert_order: 0, contract: 0 };
    c[f.kind] += 1;
    counts.set(f.client_id, c);
  }

  return ((clients ?? []) as AdClient[])
    .map((c) => {
      const n = counts.get(c.id) ?? { copy: 0, insert_order: 0, contract: 0 };
      return {
        ...c,
        copy_count: n.copy,
        insert_order_count: n.insert_order,
        contract_count: n.contract,
      };
    })
    .sort((a, b) => a.business_name.localeCompare(b.business_name, 'en', { sensitivity: 'base' }));
}

/** One client plus all its files, reverse-chron within each kind. */
export async function getAdClient(
  id: string
): Promise<{ client: AdClient; files: AdClientFile[] } | null> {
  const supabase = createClient();
  const { data: client, error } = await supabase
    .from('ad_clients')
    .select(CLIENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !client) {
    if (error) console.error('[getAdClient]', error);
    return null;
  }
  const { data: files, error: fErr } = await supabase
    .from('ad_files')
    .select(FILE_COLUMNS)
    .eq('client_id', id)
    .order('created_at', { ascending: false });
  if (fErr) console.error('[getAdClient] files', fErr);
  return { client: client as AdClient, files: (files ?? []) as AdClientFile[] };
}
