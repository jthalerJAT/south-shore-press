-- 035: per-notice header on legal notices.
-- The printed page titles most notices "PUBLIC NOTICE", but some run under a
-- different header (e.g. "Attorney"). Each saved notice carries its header so
-- re-picking it in a future issue restores the correct title.
-- Apply manually in the Supabase SQL editor (same as 002+).

ALTER TABLE public.legal_notices
  ADD COLUMN IF NOT EXISTS header text;
