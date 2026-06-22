import { createClient } from '@/lib/supabase/server';
import { NEWSPAPER_IMAGES_BUCKET, imagePublicUrl } from '@/lib/newspaper-images';

/** The "Owned Images" library — proprietary photos uploaded via the editor,
 *  indexed in `owned_images` (files live in the public newspaper-images bucket). */
export { NEWSPAPER_IMAGES_BUCKET, imagePublicUrl };

export type OwnedImage = {
  id: string;
  storage_path: string;
  file_name: string | null;
  created_at: string;
};

/** Every uploaded image, newest first. */
export async function getOwnedImages(): Promise<OwnedImage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('owned_images')
    .select('id, storage_path, file_name, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getOwnedImages]', error);
    return [];
  }
  return (data ?? []) as OwnedImage[];
}
