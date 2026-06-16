-- Newspaper Creator (print issue builder) — Phase 1 structural data
-- ===================================================================
-- Migration 007. Two tables that hold the single "current working issue":
--   np_pages — the ordered pages of the paper (Front, Page 2, …, Back).
--   np_items — the content placed on each page: independent PRINT copies
--              of stories (snapshots, editable without touching the live
--              website story) and ads. Story/ad payload lives in `data`.
--
-- Apply manually in the Supabase SQL editor (same as 002–006). Also create
-- a PUBLIC Storage bucket named `newspaper-ads` (Dashboard → Storage → New
-- bucket → Public) for uploaded ad creatives.
--
-- These are internal editor tools — editor-tier read+write via the
-- is_editor_tier() SECURITY DEFINER helper from migration 006.

CREATE TABLE IF NOT EXISTS public.np_pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_order   int  NOT NULL,
  kind         text NOT NULL,                 -- front / page2 / generic / legals / classifieds / fun_times / fantasy_baseball / betting_barton / sports / back
  title        text NOT NULL,
  section_name text,                          -- flagged section name shown top-left of the first story
  status       text NOT NULL DEFAULT 'tbd'
                 CHECK (status IN ('tbd', 'draft', 'locked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS np_pages_order_idx ON public.np_pages (page_order);

CREATE TABLE IF NOT EXISTS public.np_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         uuid NOT NULL REFERENCES public.np_pages(id) ON DELETE CASCADE,
  slot_key        text,                        -- named tile (main/lower1/oped/movies…) or null for open lists
  item_order      int  NOT NULL DEFAULT 0,
  type            text NOT NULL CHECK (type IN ('story', 'ad')),
  source_story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,  -- reference only; the print copy is independent
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- story snapshot OR ad payload
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS np_items_page_idx ON public.np_items (page_id, item_order);

-- RLS — editor-tier full access via the migration-006 helper.
ALTER TABLE public.np_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editors manage np_pages" ON public.np_pages;
CREATE POLICY "editors manage np_pages"
  ON public.np_pages
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

DROP POLICY IF EXISTS "editors manage np_items" ON public.np_items;
CREATE POLICY "editors manage np_items"
  ON public.np_items
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));
