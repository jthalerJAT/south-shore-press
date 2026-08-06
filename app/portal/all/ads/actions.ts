'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AD_FILES_BUCKET } from '@/lib/ad-files';
import type { AdFileKind } from '@/lib/queries/ad-clients';

/**
 * Server Actions for the Ad Database (clients + files, migration 039).
 * Editors add clients and files; deleting anything is admin-only.
 */

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
const ADMIN_ROLES = ['admin', 'master admin'] as const;
const BASE = '/portal/all/ads';

type Result = { ok: boolean; error?: string };

const VALID_KINDS: ReadonlyArray<AdFileKind> = ['copy', 'insert_order', 'contract'];
const VALID_SIZES = ['full', 'half', 'third', 'quarter'] as const;

function ext(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

/** Signed upload URL for an ad file → newspaper-ads (same bucket + folder
 *  layout as v1 so old and new files live side by side). */
export async function requestAdFileUploadUrl(
  kind: 'copy' | 'insert' | 'contract',
  fileName: string
): Promise<{ ok: boolean; error?: string; path?: string; token?: string }> {
  await requireRole([...EDITOR_ROLES], BASE);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Uploads are not configured on this deployment.' };
  }
  const folder = kind === 'insert' ? 'insert-orders' : kind === 'contract' ? 'contracts' : 'copy';
  // Ad COPY must render on a newspaper page, and web browsers can't decode
  // HEIC/HEIF (iPhone photos). Insert orders / contracts are records, not
  // renderables, so they stay unrestricted.
  const fileExt = ext(fileName);
  if (kind === 'copy' && (fileExt === '.heic' || fileExt === '.heif')) {
    return {
      ok: false,
      error: 'HEIC/HEIF (iPhone photo format) can’t be displayed by web browsers — export the ad copy as JPG or PNG and upload that instead.',
    };
  }
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

export type ClientInput = {
  business_name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
};

export type NewFileInput = {
  kind: AdFileKind;
  storage_path: string;
  file_name: string;
  /** Required for kind 'copy'; ignored otherwise. */
  copy_size?: string;
};

function normalizeFile(f: NewFileInput): NewFileInput | null {
  if (!VALID_KINDS.includes(f.kind)) return null;
  if (!f.storage_path) return null;
  if (f.kind === 'copy') {
    const size = (f.copy_size ?? '').toLowerCase();
    if (!(VALID_SIZES as readonly string[]).includes(size)) return null;
    return { ...f, copy_size: size };
  }
  return { ...f, copy_size: undefined };
}

/** Create a client, optionally with initial files (the New Client form's
 *  uploads). Files with a missing/invalid size on copy are rejected up front
 *  so nothing half-saves. */
export async function createAdClient(
  input: ClientInput,
  files: NewFileInput[] = []
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const user = await requireRole([...EDITOR_ROLES], BASE);
  const name = input.business_name?.trim();
  if (!name) return { ok: false, error: 'Business name is required.' };

  const normalized: NewFileInput[] = [];
  for (const f of files) {
    const n = normalizeFile(f);
    if (!n) return { ok: false, error: 'Every uploaded copy needs a valid Copy Size.' };
    normalized.push(n);
  }

  const admin = createAdminClient();

  // One client per business — creating a duplicate name is almost always a
  // mistake that scatters the client's files across two folders.
  const { data: existing } = await admin
    .from('ad_clients')
    .select('id, business_name')
    .ilike('business_name', name);
  if ((existing ?? []).some((c) => c.business_name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A client named "${name}" already exists — open it and add the files there.` };
  }

  const { data, error } = await admin
    .from('ad_clients')
    .insert({
      business_name: name,
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createAdClient]', error);
    return { ok: false, error: 'Could not create the client.' };
  }
  const clientId = data.id as string;

  if (normalized.length) {
    const { error: fErr } = await admin.from('ad_files').insert(
      normalized.map((f) => ({
        client_id: clientId,
        kind: f.kind,
        storage_path: f.storage_path,
        file_name: f.file_name || null,
        copy_size: f.kind === 'copy' ? f.copy_size : null,
        created_by: user.id,
      }))
    );
    if (fErr) {
      console.error('[createAdClient] files', fErr);
      return { ok: false, error: 'Client created, but saving its files failed — open the client and re-add them.', id: clientId };
    }
  }

  revalidatePath(BASE);
  return { ok: true, id: clientId };
}

export async function updateAdClient(id: string, input: ClientInput): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
  if (!input.business_name?.trim()) return { ok: false, error: 'Business name is required.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('ad_clients')
    .update({
      business_name: input.business_name.trim(),
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
    })
    .eq('id', id);
  if (error) {
    console.error('[updateAdClient]', error);
    return { ok: false, error: 'Could not save the client.' };
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  return { ok: true };
}

/** Admin-only: remove a client, every DB file row (cascade), and the storage
 *  objects. */
export async function deleteAdClient(id: string): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();

  const { data: files } = await admin.from('ad_files').select('storage_path').eq('client_id', id);
  const paths = (files ?? []).map((f) => (f as { storage_path: string }).storage_path).filter(Boolean);
  if (paths.length) {
    const { error: rmErr } = await admin.storage.from(AD_FILES_BUCKET).remove(paths);
    if (rmErr) console.error('[deleteAdClient] storage remove', rmErr);
  }

  const { error } = await admin.from('ad_clients').delete().eq('id', id); // ad_files cascade
  if (error) {
    console.error('[deleteAdClient]', error);
    return { ok: false, error: 'Could not delete the client.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Add one uploaded file to an existing client ("+ New" on the client page). */
export async function addAdClientFile(clientId: string, file: NewFileInput): Promise<Result> {
  const user = await requireRole([...EDITOR_ROLES], BASE);
  const n = normalizeFile(file);
  if (!n) {
    return {
      ok: false,
      error: file.kind === 'copy' ? 'Select a Copy Size before saving.' : 'Invalid file.',
    };
  }
  const admin = createAdminClient();
  const { error } = await admin.from('ad_files').insert({
    client_id: clientId,
    kind: n.kind,
    storage_path: n.storage_path,
    file_name: n.file_name || null,
    copy_size: n.kind === 'copy' ? n.copy_size : null,
    created_by: user.id,
  });
  if (error) {
    console.error('[addAdClientFile]', error);
    return { ok: false, error: 'Could not save the file.' };
  }
  revalidatePath(`${BASE}/${clientId}`);
  return { ok: true };
}

/** Admin-only: remove one file (DB row + storage object). */
export async function deleteAdClientFile(fileId: string, clientId: string): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();
  const { data: file } = await admin
    .from('ad_files')
    .select('storage_path')
    .eq('id', fileId)
    .maybeSingle();
  if (file?.storage_path) {
    const { error: rmErr } = await admin.storage
      .from(AD_FILES_BUCKET)
      .remove([file.storage_path as string]);
    if (rmErr) console.error('[deleteAdClientFile] storage remove', rmErr);
  }
  const { error } = await admin.from('ad_files').delete().eq('id', fileId);
  if (error) {
    console.error('[deleteAdClientFile]', error);
    return { ok: false, error: 'Could not delete the file.' };
  }
  revalidatePath(`${BASE}/${clientId}`);
  return { ok: true };
}
