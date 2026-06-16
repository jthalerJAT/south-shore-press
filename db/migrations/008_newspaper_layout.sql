-- Newspaper Creator — Phase 2 visual layout engine (per-item geometry)
-- ===================================================================
-- Migration 008. Adds the geometry needed by the visual "Edit Page Layout"
-- engine, plus nullable continuation fields used later by Phase 2B
-- (overflow → second page + "Continued on/from Page X"). Adding the 2B
-- fields now means 2B is pure app code — no second migration.
--
-- Apply manually in the Supabase SQL editor (same as 002–007). Idempotent.
--
-- Geometry lives in its OWN `layout` jsonb column (NOT inside `data`) so the
-- editorial snapshot in `data` and the board summary query (getItemSummaries,
-- which selects `data`) are completely untouched by layout writes.

-- Per-item layout geometry. Column-relative + fractional coordinates so the
-- on-screen canvas and the print proof reproduce the layout identically at
-- any pixel size. Defaults to '{}' → the renderer normalises missing fields,
-- so pre-Phase-2 rows keep working.
ALTER TABLE public.np_items
  ADD COLUMN IF NOT EXISTS layout jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Phase 2B forward fields. Nullable + unused until 2B; present now so the
-- continuation model (linked rows, one body slice per page) needs no further
-- migration. NULL continuation_group == an ordinary single-page item.
ALTER TABLE public.np_items
  ADD COLUMN IF NOT EXISTS continuation_group     uuid,
  ADD COLUMN IF NOT EXISTS continues_on_page_id   uuid,
  ADD COLUMN IF NOT EXISTS continued_from_page_id uuid,
  ADD COLUMN IF NOT EXISTS slice_index            int,
  ADD COLUMN IF NOT EXISTS body_offset_start      int,
  ADD COLUMN IF NOT EXISTS body_offset_end        int;

-- The two page pointers drive the "Continued on/from Page X" lines. ON DELETE
-- SET NULL so deleting a page never errors — the continuation just unlinks.
ALTER TABLE public.np_items
  DROP CONSTRAINT IF EXISTS np_items_continues_on_page_fk;
ALTER TABLE public.np_items
  ADD  CONSTRAINT np_items_continues_on_page_fk
       FOREIGN KEY (continues_on_page_id)
       REFERENCES public.np_pages(id) ON DELETE SET NULL;

ALTER TABLE public.np_items
  DROP CONSTRAINT IF EXISTS np_items_continued_from_page_fk;
ALTER TABLE public.np_items
  ADD  CONSTRAINT np_items_continued_from_page_fk
       FOREIGN KEY (continued_from_page_id)
       REFERENCES public.np_pages(id) ON DELETE SET NULL;

-- Partial index — only the (rare) multi-page stories are indexed.
CREATE INDEX IF NOT EXISTS np_items_continuation_group_idx
  ON public.np_items (continuation_group)
  WHERE continuation_group IS NOT NULL;

-- RLS unchanged: the migration-007 "editors manage np_items" FOR ALL policy
-- already covers the new columns. No policy edits required.
