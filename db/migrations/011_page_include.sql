-- Newspaper Creator — "Include in paper" per-page flag (Phase 7 follow-up)
-- ===================================================================
-- Migration 011. A checkbox per page in the board controls whether the page
-- is part of the printed issue. Drives both the View File proof and the
-- plugin's whole-issue InDesign build (only checked pages, in list order).
--
-- Apply manually in the Supabase SQL editor (same as 002–010). Idempotent.

ALTER TABLE public.np_pages
  ADD COLUMN IF NOT EXISTS include_in_paper boolean NOT NULL DEFAULT true;
