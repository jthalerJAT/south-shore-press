-- 054_eastern_day_buckets.sql (idempotent, manual-apply in the Supabase SQL editor)
--
-- Traffic days roll over at midnight EASTERN, not midnight UTC.
-- Publisher report 2026-10-21 ~8pm ET: "Today" reset to near-zero and the
-- top-content list emptied in the evening — because current_date in the
-- RPCs evaluates in the database's UTC timezone, the day flipped at 8pm ET.
-- Both increment RPCs (033 story_views, 051 site_views) and the column
-- defaults now bucket by the America/New_York calendar day. Handles DST.
--
-- Historical rows keep their UTC-day buckets (views between 8pm and
-- midnight ET were credited to the next day); not worth restating.

ALTER TABLE public.story_views
  ALTER COLUMN day SET DEFAULT (now() AT TIME ZONE 'America/New_York')::date;
ALTER TABLE public.site_views
  ALTER COLUMN day SET DEFAULT (now() AT TIME ZONE 'America/New_York')::date;

CREATE OR REPLACE FUNCTION public.increment_story_view(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.story_views (story_id, day, views)
  VALUES (p_story_id, (now() AT TIME ZONE 'America/New_York')::date, 1)
  ON CONFLICT (story_id, day)
  DO UPDATE SET views = story_views.views + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_site_view()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.site_views (day, views)
  VALUES ((now() AT TIME ZONE 'America/New_York')::date, 1)
  ON CONFLICT (day) DO UPDATE SET views = site_views.views + 1;
$$;

-- Sanity: both should show today's EASTERN date as max(day) after traffic hits
-- SELECT max(day) FROM public.site_views;
