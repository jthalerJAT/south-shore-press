-- 050_issue_variants.sql
-- TWO COEXISTING ISSUES (publisher direction 2026-10-07): the "Election
-- Issue" board toggle must NOT destroy the standard issue. Every np_pages row
-- now belongs to an issue variant ('standard' | 'election'), and a tiny
-- settings table records which variant is ACTIVE. The board, editors, View
-- File, Reset Content, Rebuild Pages, and the press export all operate on the
-- active variant only, so a fully built standard paper and a fully built
-- election paper can exist side by side and the toggle just switches between
-- them.
--
-- Idempotent; run in the Supabase SQL editor. Apply together with the
-- same-day code deploy (the toggle and page-add actions write the new
-- column).

-- 1) Variant column — existing rows become the standard issue.
ALTER TABLE public.np_pages
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'standard';

-- Safety: any election pages created before this migration belong to the
-- election issue.
UPDATE public.np_pages SET variant = 'election' WHERE kind = 'election';

CREATE INDEX IF NOT EXISTS np_pages_variant_order_idx
  ON public.np_pages (variant, page_order);

-- 2) Which variant the Newspaper Creator is showing / exporting.
CREATE TABLE IF NOT EXISTS public.np_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.np_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editor tier manages np_settings" ON public.np_settings;
CREATE POLICY "editor tier manages np_settings"
  ON public.np_settings FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));
-- (The press-export route reads with the service role, which bypasses RLS.)

INSERT INTO public.np_settings (key, value)
VALUES ('active_variant', 'standard')
ON CONFLICT (key) DO NOTHING;

-- Sanity:
-- SELECT variant, count(*) FROM public.np_pages GROUP BY 1;
-- SELECT * FROM public.np_settings;
