'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NEWSPAPER_IMAGES_BUCKET } from '@/lib/newspaper-images';

// Deleting from the library is admin-only; journalists and editors may add
// (their story photos) but not delete from it.
const ADMIN_ROLES = ['admin', 'master admin'] as const;
const CONTRIBUTOR_ROLES = ['journalist', 'editor', 'admin', 'master admin'] as const;
const BASE = '/portal/all/owned-images';

type Result = { ok: boolean; error?: string };

/** Index an uploaded image in the Owned Images library. Called right after a
 *  photo is uploaded to the newspaper-images bucket (from any Photo field).
 *  Open to journalists — they add photos to stories they're working on. */
export async function recordOwnedImage(storagePath: string, fileName?: string): Promise<Result> {
  const user = await requireRole([...CONTRIBUTOR_ROLES], BASE);
  const admin = createAdminClient();
  const { error } = await admin
    .from('owned_images')
    .insert({ storage_path: storagePath, file_name: fileName ?? null, created_by: user.id });
  if (error) {
    console.error('[recordOwnedImage]', error);
    return { ok: false, error: 'Could not save to Owned Images.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Rename a library image (display name only — the storage file is untouched,
 *  so URLs already pasted into stories keep working). */
export async function renameOwnedImage(id: string, fileName: string): Promise<Result> {
  await requireRole([...CONTRIBUTOR_ROLES], BASE);
  const name = fileName.trim();
  if (!name) return { ok: false, error: 'Name cannot be empty.' };
  if (name.length > 200) return { ok: false, error: 'Name is too long.' };
  const admin = createAdminClient();
  const { error } = await admin.from('owned_images').update({ file_name: name }).eq('id', id);
  if (error) {
    console.error('[renameOwnedImage]', error);
    return { ok: false, error: 'Could not rename the image.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}

/** Search the library by name — feeds the pick-from-library modal on photo
 *  fields. Empty query returns the newest images. */
export async function searchOwnedImages(
  query: string
): Promise<{ ok: boolean; error?: string; images?: Array<{ id: string; url: string; fileName: string | null; createdAt: string }> }> {
  await requireRole([...CONTRIBUTOR_ROLES], BASE);
  const admin = createAdminClient();
  let q = admin
    .from('owned_images')
    .select('id, storage_path, file_name, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const needle = query.trim();
  if (needle) q = q.ilike('file_name', `%${needle.replace(/[%_]/g, '\\$&')}%`);
  const { data, error } = await q;
  if (error) {
    console.error('[searchOwnedImages]', error);
    return { ok: false, error: 'Could not search the library.' };
  }
  const { imagePublicUrl } = await import('@/lib/newspaper-images');
  return {
    ok: true,
    images: (data ?? []).map((r) => ({
      id: r.id as string,
      url: imagePublicUrl(r.storage_path as string),
      fileName: (r.file_name as string | null) ?? null,
      createdAt: r.created_at as string,
    })),
  };
}

/** Remove an image from the library + its storage object. */
export async function deleteOwnedImage(id: string): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();
  const { data } = await admin
    .from('owned_images')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (data?.storage_path) {
    await admin.storage.from(NEWSPAPER_IMAGES_BUCKET).remove([data.storage_path as string]);
  }
  const { error } = await admin.from('owned_images').delete().eq('id', id);
  if (error) {
    console.error('[deleteOwnedImage]', error);
    return { ok: false, error: 'Could not delete the image.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}
