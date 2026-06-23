-- 017_story_photo_caption_credit.sql
-- ----------------------------------------------------------------------------
-- Optional hero-photo caption + credit on stories.
--
-- The New Story / Edit Story form now has "Photo caption" and "Photo credit"
-- fields (both optional). They render under the hero photo on the public
-- article page. Nullable text — no backfill needed.
--
-- Idempotent + manual-apply (Supabase SQL editor), same style as 002–016.
-- ----------------------------------------------------------------------------

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS photo_caption text,
  ADD COLUMN IF NOT EXISTS photo_credit  text;
