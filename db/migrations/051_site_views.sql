-- 051_site_views.sql
-- SITE-WIDE TRAFFIC COUNTER for the portal's Traffic Stats tile
-- (publisher direction 2026-10-09). story_views (033) counts article pages
-- only; this adds a one-row-per-day total for ALL public pages, fed by a
-- site-wide beacon (components/site-view-tracker.tsx → /api/track/page).
--
-- History: seeded below from story_views' daily sums, so the tile has a
-- trendline from day one. Days before 2026-10-09 therefore reflect ARTICLE
-- views only; from the deploy on, every public page view counts. Days are
-- UTC buckets (same as story_views).
--
-- Idempotent; run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.site_views (
  day    date PRIMARY KEY DEFAULT current_date,
  views  integer NOT NULL DEFAULT 0
);

-- Service-role only (no policies) — same posture as story_views.
ALTER TABLE public.site_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.increment_site_view()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.site_views (day, views)
  VALUES (current_date, 1)
  ON CONFLICT (day) DO UPDATE SET views = site_views.views + 1;
$$;

-- Backfill from the article-view history (no-op for days already present,
-- so re-running never overwrites live counts).
INSERT INTO public.site_views (day, views)
SELECT day, SUM(views) FROM public.story_views GROUP BY day
ON CONFLICT (day) DO NOTHING;

-- Sanity:
-- SELECT count(*), min(day), max(day), sum(views) FROM public.site_views;
