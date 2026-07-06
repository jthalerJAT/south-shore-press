import { createClient } from '@/lib/supabase/client';
import { AD_FILES_BUCKET } from '@/lib/ad-files';
import { requestAdFileUploadUrl, verifyAdFileUploaded } from './actions';

/** Upload an ad file (copy or insert order) straight to Storage via a
 *  short-lived signed URL minted by the editor-gated server action. */
export async function uploadAdFile(
  kind: 'copy' | 'insert' | 'contract',
  file: File
): Promise<{ ok: boolean; path?: string; fileName?: string; error?: string }> {
  const signed = await requestAdFileUploadUrl(kind, file.name);
  if (!signed.ok || !signed.path || !signed.token) {
    return { ok: false, error: signed.error ?? 'Upload could not start.' };
  }
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(AD_FILES_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };

  // Defensive: confirm the object actually persisted before reporting success.
  // Signed uploads can occasionally return success without the file landing on
  // a flaky connection, which would otherwise save a path whose file 404s.
  const landed = await verifyAdFileUploaded(signed.path);
  if (!landed) {
    return { ok: false, error: 'Upload didn’t complete — please try again.' };
  }

  return { ok: true, path: signed.path, fileName: file.name };
}
