'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NEWSPAPER_IMAGES_BUCKET } from '@/lib/newspaper-images';

const EDITOR_ROLES = ['editor', 'admin', 'master admin'] as const;
// Journalists may ADD to the library (their story photos) but not delete from it.
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

/** Remove an image from the library + its storage object. */
export async function deleteOwnedImage(id: string): Promise<Result> {
  await requireRole([...EDITOR_ROLES], BASE);
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
