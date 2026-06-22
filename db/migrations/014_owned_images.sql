-- 014_owned_images.sql
-- "Owned Images" library: a record of every proprietary photo uploaded through
-- the editor (so the Owned Images tile can list them reverse-chron with
-- thumbnails). The files themselves live in the existing public
-- `newspaper-images` bucket; this table just indexes them.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–013).

CREATE TABLE IF NOT EXISTS public.owned_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,              -- path in the newspaper-images bucket
  file_name    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

CREATE INDEX IF NOT EXISTS owned_images_created_idx ON public.owned_images (created_at DESC);

ALTER TABLE public.owned_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editors manage owned_images" ON public.owned_images;
CREATE POLICY "editors manage owned_images" ON public.owned_images
  FOR ALL USING (public.is_editor_tier(auth.uid())) WITH CHECK (public.is_editor_tier(auth.uid()));
