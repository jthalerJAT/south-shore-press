-- 033_story_views.sql
-- Lightweight story-view counting, bucketed by day. Powers the "You Might Also
-- Be Interested In" fallback (most-viewed site-wide in the last 24h) on thin
-- section tabs. A client beacon on each story page POSTs to /api/track/view,
-- which calls the increment RPC via the service-role client.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–032).

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  day      date NOT NULL DEFAULT current_date,
  views    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, day)
);

CREATE INDEX IF NOT EXISTS story_views_day_idx ON public.story_views (day);

-- Service-role only (the beacon route + trending query both use the admin
-- client); no public policies.
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.increment_story_view(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.story_views (story_id, day, views)
  VALUES (p_story_id, current_date, 1)
  ON CONFLICT (story_id, day)
  DO UPDATE SET views = story_views.views + 1;
END;
$$;
