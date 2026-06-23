'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { CLASSIFIEDS_BUCKET } from '@/lib/queries/classifieds';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
// Deleting classifieds is admin-only; editors may add but not remove.
const ADMIN_ROLES = ['admin', 'master admin'] as const;
const BASE = '/portal/all/classifieds';

/** Mint a signed upload URL so the browser can upload a PDF straight to
 *  Storage (no Vercel body-size limit). Editor-gated. */
export async function requestClassifiedUploadUrl(): Promise<{
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}> {
  await requireRole([...EDITOR_ROLES], BASE);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Uploads are not configured on this deployment.' };
  }
  const path = `${randomUUID()}.pdf`;
  const { data, error } = await admin.storage
    .from(CLASSIFIEDS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestClassifiedUploadUrl]', error);
    return { ok: false, error: 'Could not start the upload. Is the `classifieds` bucket created?' };
  }
  return { ok: true, path, token: data.token };
}

function validDate(year: number, month: number, day: number): boolean {
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** Record an uploaded classified PDF. Editor-gated. */
export async function createClassifiedAction(input: {
  year: number;
  month: number;
  day: number;
  storage_path: string;
  file_name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...EDITOR_ROLES], BASE);

  if (!validDate(input.year, input.month, input.day)) {
    return { ok: false, error: 'Please choose a valid date.' };
  }
  if (!input.storage_path) {
    return { ok: false, error: 'Upload did not complete. Please try again.' };
  }
  const classified_date = `${input.year}-${String(input.month).padStart(2, '0')}-${String(
    input.day
  ).padStart(2, '0')}`;

  const admin = createAdminClient();
  const { error } = await admin.from('classifieds').insert({
    classified_date,
    storage_path: input.storage_path,
    file_name: input.file_name || null,
    created_by: user.id,
  });
  if (error) {
    console.error('[createClassifiedAction]', error);
    return { ok: false, error: 'Could not save the classified. Please try again.' };
  }

  revalidatePath(BASE);
  revalidatePath('/portal/all/newspaper-creator');
  return { ok: true };
}

/** Delete a classified (DB row + Storage object). Admin-gated. */
export async function deleteClassifiedAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES], BASE);
  if (!id) return { ok: false, error: 'Missing id.' };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('classifieds')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (row?.storage_path) {
    const { error: rmErr } = await admin.storage
      .from(CLASSIFIEDS_BUCKET)
      .remove([row.storage_path as string]);
    if (rmErr) console.error('[deleteClassifiedAction] storage remove', rmErr);
  }

  const { error } = await admin.from('classifieds').delete().eq('id', id);
  if (error) {
    console.error('[deleteClassifiedAction]', error);
    return { ok: false, error: 'Could not delete. Please try again.' };
  }

  revalidatePath(BASE);
  revalidatePath('/portal/all/newspaper-creator');
  return { ok: true };
}
