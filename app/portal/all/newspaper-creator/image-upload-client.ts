import { createClient } from '@/lib/supabase/client';
import { NEWSPAPER_IMAGES_BUCKET, imagePublicUrl } from '@/lib/newspaper-images';
import { requestImageUploadUrl } from './actions';
import { recordOwnedImage } from '../owned-images/actions';

/** Upload an editorial photo to the newspaper-images bucket via a signed URL,
 *  index it in the Owned Images library, and return its public URL (also stored
 *  directly on the page's data so the story renders it). */
export async function uploadImage(
  file: File
): Promise<{ ok: boolean; url?: string; fileName?: string; error?: string }> {
  const signed = await requestImageUploadUrl(file.name);
  if (!signed.ok || !signed.path || !signed.token) {
    return { ok: false, error: signed.error ?? 'Upload could not start.' };
  }
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(NEWSPAPER_IMAGES_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };
  // Index it in the Owned Images library (best-effort — never block the upload).
  recordOwnedImage(signed.path, file.name).catch(() => {});
  return { ok: true, url: imagePublicUrl(signed.path), fileName: file.name };
}
