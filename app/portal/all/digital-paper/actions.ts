'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { DIGITAL_PAPERS_BUCKET } from '@/lib/queries/digital-papers';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
// Deleting issues is admin-only; editors may add but not remove.
const ADMIN_ROLES = ['admin', 'master admin'] as const;

const BASE = '/portal/all/digital-paper';

/** Mint a signed upload URL so the browser can upload the PDF straight to
 *  Storage (no Vercel body-size limit). Editor-gated. */
export async function requestDigitalPaperUploadUrl(): Promise<{
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
    .from(DIGITAL_PAPERS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[requestDigitalPaperUploadUrl]', error);
    return {
      ok: false,
      error: 'Could not start the upload — run migration 047 (digital-papers bucket) first.',
    };
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

/** Record an uploaded issue PDF. One row per issue date — re-uploading the
 *  same date replaces the previous file. Editor-gated. */
export async function createDigitalPaperAction(input: {
  year: number;
  month: number;
  day: number;
  storage_path: string;
  file_name: string;
  page_count?: number | null;
  file_size_bytes?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...EDITOR_ROLES], BASE);

  if (!validDate(input.year, input.month, input.day)) {
    return { ok: false, error: 'Please choose a valid issue date.' };
  }
  if (!input.storage_path) {
    return { ok: false, error: 'Upload did not complete. Please try again.' };
  }
  const issue_date = `${input.year}-${String(input.month).padStart(2, '0')}-${String(
    input.day
  ).padStart(2, '0')}`;

  const admin = createAdminClient();

  // Replace-in-place: if this issue date already has a file, remove the old
  // storage object and update the row rather than failing the unique index.
  const { data: existing } = await admin
    .from('digital_papers')
    .select('id, storage_path')
    .eq('issue_date', issue_date)
    .maybeSingle();

  if (existing) {
    if (existing.storage_path && existing.storage_path !== input.storage_path) {
      const { error: rmErr } = await admin.storage
        .from(DIGITAL_PAPERS_BUCKET)
        .remove([existing.storage_path as string]);
      if (rmErr) console.error('[createDigitalPaperAction] old object remove', rmErr);
    }
    const { error } = await admin
      .from('digital_papers')
      .update({
        storage_path: input.storage_path,
        file_name: input.file_name || null,
        page_count: input.page_count ?? null,
        file_size_bytes: input.file_size_bytes ?? null,
        created_by: user.id,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[createDigitalPaperAction] update', error);
      return { ok: false, error: 'Could not replace the issue. Please try again.' };
    }
  } else {
    const { error } = await admin.from('digital_papers').insert({
      issue_date,
      storage_path: input.storage_path,
      file_name: input.file_name || null,
      page_count: input.page_count ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      created_by: user.id,
    });
    if (error) {
      console.error('[createDigitalPaperAction]', error);
      const missing = error.code === '42P01' || error.code === 'PGRST205';
      return {
        ok: false,
        error: missing
          ? 'The digital_papers table does not exist yet — run migration 047 in Supabase.'
          : 'Could not save the issue. Please try again.',
      };
    }
  }

  revalidatePath(BASE);
  return { ok: true };
}

/** Delete an issue (DB row + Storage object). Admin-only. */
export async function deleteDigitalPaperAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES], BASE);
  if (!id) return { ok: false, error: 'Missing id.' };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('digital_papers')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (row?.storage_path) {
    const { error: rmErr } = await admin.storage
      .from(DIGITAL_PAPERS_BUCKET)
      .remove([row.storage_path as string]);
    if (rmErr) console.error('[deleteDigitalPaperAction] storage remove', rmErr);
  }

  const { error } = await admin.from('digital_papers').delete().eq('id', id);
  if (error) {
    console.error('[deleteDigitalPaperAction]', error);
    return { ok: false, error: 'Could not delete. Please try again.' };
  }

  revalidatePath(BASE);
  return { ok: true };
}
