'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AD_FILES_BUCKET } from '@/lib/queries/ads';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
// Deleting ads / ad runs is admin-only; editors may add and edit but not delete.
const ADMIN_ROLES = ['admin', 'master admin'] as const;
const BASE = '/portal/all/ads';

type Result = { ok: boolean; error?: string };

function ext(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

/** Signed upload URL for an ad file (copy or insert order) → newspaper-ads. */
export async function requestAdFileUploadUrl(
  kind: 'copy' | 'insert',
  fileName: string
): Promise<{ ok: boolean; error?: string; path?: string; token?: string }> {
  await requireRole([...EDITOR_ROLES], BASE);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Uploads are not configured on this deployment.' };
  }
  const folder = kind === 'insert' ? 'insert-orders' : 'copy';
  const path = `${folder}/${randomUUID()}${ext(fileName)}`;
  const { data, error } = await admin.storage.from(AD_FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestAdFileUploadUrl]', error);
    return { ok: false, error: 'Could not start the upload. Is the `newspaper-ads` bucket created?' };
  }
  return { ok: true, path, token: data.token };
}

/** Confirm an uploaded ad file actually landed in storage. Signed uploads can
 *  occasionally report success without persisting (flaky connection), which
 *  would save a path whose file 404s on view. Called right after upload so a
 *  silent failure surfaces as an error instead of a broken link. */
export async function verifyAdFileUploaded(path: string): Promise<boolean> {
  await requireRole([...EDITOR_ROLES], BASE);
  if (!path) return false;
  const admin = createAdminClient();
  const slash = path.lastIndexOf('/');
  const folder = slash >= 0 ? path.slice(0, slash) : '';
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const { data, error } = await admin.storage
    .from(AD_FILES_BUCKET)
    .list(folder, { search: name, limit: 100 });
  if (error) {
    console.error('[verifyAdFileUploaded]', error);
    return false;
  }
  return Boolean(data?.some((o) => o.name === name));
}

export type AdInput = {
  business_name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  copy_storage_path?: string;
  copy_file_name?: string;
  copy_size?: string;
  insert_order_path?: string;
  insert_order_file_name?: string;
};

export async function createAd(
  input: AdInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const user = await requireRole([...EDITOR_ROLES], BASE);
  if (!input.business_name?.trim()) return { ok: false, error: 'Business name is required.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ads')
    .insert({
      business_name: input.business_name.trim(),
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      copy_storage_path: input.copy_storage_path || null,
      copy_file_name: input.copy_file_name || null,
      copy_size: input.copy_size || null,
      insert_order_path: input.insert_order_path || null,
      insert_order_file_name: input.insert_order_file_name || null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createAd]', error);
    return { ok: false, error: 'Could not save the ad.' };
  }
  revalidatePath(BASE);
  return { ok: true, id: data.id as string };
}

export async function updateAd(id: string, input: AdInput): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  if (!input.business_name?.trim()) return { ok: false, error: 'Business name is required.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('ads')
    .update({
      business_name: input.business_name.trim(),
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      copy_storage_path: input.copy_storage_path || null,
      copy_file_name: input.copy_file_name || null,
      copy_size: input.copy_size || null,
      insert_order_path: input.insert_order_path || null,
      insert_order_file_name: input.insert_order_file_name || null,
    })
    .eq('id', id);
  if (error) {
    console.error('[updateAd]', error);
    return { ok: false, error: 'Could not save the ad.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  return { ok: true };
}

export async function deleteAd(id: string): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();

  // Gather storage paths (ad copy + every run's insert order) to clean up.
  const paths: string[] = [];
  const { data: ad } = await admin
    .from('ads')
    .select('copy_storage_path, insert_order_path')
    .eq('id', id)
    .maybeSingle();
  if (ad?.copy_storage_path) paths.push(ad.copy_storage_path as string);
  if (ad?.insert_order_path) paths.push(ad.insert_order_path as string);
  const { data: runs } = await admin.from('ad_runs').select('insert_order_path').eq('ad_id', id);
  for (const r of runs ?? []) {
    const p = (r as { insert_order_path: string | null }).insert_order_path;
    if (p) paths.push(p);
  }
  if (paths.length) {
    const { error: rmErr } = await admin.storage.from(AD_FILES_BUCKET).remove(paths);
    if (rmErr) console.error('[deleteAd] storage remove', rmErr);
  }

  const { error } = await admin.from('ads').delete().eq('id', id); // ad_runs cascade
  if (error) {
    console.error('[deleteAd]', error);
    return { ok: false, error: 'Could not delete the ad.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

export type AdRunInput = {
  date_started?: string | null;
  num_weeks?: number | null;
  price_per_week?: number | null;
  page_size?: string | null;
  insert_order_path?: string | null;
  insert_order_file_name?: string | null;
  invoiced?: boolean;
  paid?: boolean;
};

function runRow(input: AdRunInput) {
  return {
    date_started: input.date_started || null,
    num_weeks: input.num_weeks ?? null,
    price_per_week: input.price_per_week ?? null,
    page_size: input.page_size?.trim() || null,
    insert_order_path: input.insert_order_path || null,
    insert_order_file_name: input.insert_order_file_name || null,
    invoiced: Boolean(input.invoiced),
    paid: Boolean(input.paid),
  };
}

export async function addAdRun(adId: string, input: AdRunInput): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const admin = createAdminClient();
  const { error } = await admin.from('ad_runs').insert({ ad_id: adId, ...runRow(input) });
  if (error) {
    console.error('[addAdRun]', error);
    return { ok: false, error: 'Could not add the ad run.' };
  }
  revalidatePath(`${BASE}/${adId}`);
  return { ok: true };
}

export async function updateAdRun(id: string, adId: string, input: AdRunInput): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  const admin = createAdminClient();
  const { error } = await admin.from('ad_runs').update(runRow(input)).eq('id', id);
  if (error) {
    console.error('[updateAdRun]', error);
    return { ok: false, error: 'Could not save the ad run.' };
  }
  revalidatePath(`${BASE}/${adId}`);
  return { ok: true };
}

export async function deleteAdRun(id: string, adId: string): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();
  const { data: run } = await admin
    .from('ad_runs')
    .select('insert_order_path')
    .eq('id', id)
    .maybeSingle();
  if (run?.insert_order_path) {
    await admin.storage.from(AD_FILES_BUCKET).remove([run.insert_order_path as string]);
  }
  const { error } = await admin.from('ad_runs').delete().eq('id', id);
  if (error) {
    console.error('[deleteAdRun]', error);
    return { ok: false, error: 'Could not delete the ad run.' };
  }
  revalidatePath(`${BASE}/${adId}`);
  return { ok: true };
}
