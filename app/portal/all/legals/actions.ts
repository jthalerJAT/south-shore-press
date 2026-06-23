'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { LEGALS_BUCKET } from '@/lib/queries/legals';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
// Deleting legals is admin-only; editors may add but not remove.
const ADMIN_ROLES = ['admin', 'master admin'] as const;

/** Mint a signed upload URL so the browser can upload a PDF straight to
 *  Storage (no Vercel body-size limit). Editor-gated. */
export async function requestLegalUploadUrl(): Promise<{
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}> {
  await requireRole([...EDITOR_ROLES], '/portal/all/legals');
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Uploads are not configured on this deployment.' };
  }
  const path = `${randomUUID()}.pdf`;
  const { data, error } = await admin.storage
    .from(LEGALS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestLegalUploadUrl]', error);
    return { ok: false, error: 'Could not start the upload. Is the `legals` bucket created?' };
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

/** Record an uploaded legal PDF. Editor-gated. */
export async function createLegalAction(input: {
  year: number;
  month: number;
  day: number;
  storage_path: string;
  file_name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...EDITOR_ROLES], '/portal/all/legals');

  if (!validDate(input.year, input.month, input.day)) {
    return { ok: false, error: 'Please choose a valid date.' };
  }
  if (!input.storage_path) {
    return { ok: false, error: 'Upload did not complete. Please try again.' };
  }
  const legal_date = `${input.year}-${String(input.month).padStart(2, '0')}-${String(
    input.day
  ).padStart(2, '0')}`;

  const admin = createAdminClient();
  const { error } = await admin.from('legals').insert({
    legal_date,
    storage_path: input.storage_path,
    file_name: input.file_name || null,
    created_by: user.id,
  });
  if (error) {
    console.error('[createLegalAction]', error);
    return { ok: false, error: 'Could not save the legal. Please try again.' };
  }

  revalidatePath('/legals');
  revalidatePath('/portal/all/legals');
  return { ok: true };
}

/** Delete a legal (DB row + Storage object). Editor-gated. */
export async function deleteLegalAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES], '/portal/all/legals');
  if (!id) return { ok: false, error: 'Missing id.' };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('legals')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (row?.storage_path) {
    const { error: rmErr } = await admin.storage
      .from(LEGALS_BUCKET)
      .remove([row.storage_path as string]);
    if (rmErr) console.error('[deleteLegalAction] storage remove', rmErr);
  }

  const { error } = await admin.from('legals').delete().eq('id', id);
  if (error) {
    console.error('[deleteLegalAction]', error);
    return { ok: false, error: 'Could not delete. Please try again.' };
  }

  revalidatePath('/legals');
  revalidatePath('/portal/all/legals');
  return { ok: true };
}
