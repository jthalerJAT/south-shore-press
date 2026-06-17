-- Newspaper Creator — templated "master" pages (Phase 6)
-- ===================================================================
-- Migration 009. Repeating weekly pages (Front Page, section covers, …) are
-- driven by a bespoke field form rather than freehand flow layout. Their
-- structured fields live in a single jsonb on the page row.
--
-- Apply manually in the Supabase SQL editor (same as 002–008). Idempotent.
-- No new table or bucket: master-ness is derived from `kind` in code, and
-- template photos are URL fields (like stories' hero_photo_url).

ALTER TABLE public.np_pages
  ADD COLUMN IF NOT EXISTS template_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- RLS unchanged: the migration-007 "editors manage np_pages" FOR ALL policy
-- already covers the new column.
