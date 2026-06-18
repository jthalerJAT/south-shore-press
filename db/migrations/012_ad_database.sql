-- Ad Database (Phase 8, Stage A)
-- ===================================================================
-- Migration 012. A self-serve ad CRM for the editor portal: advertisers and
-- their copy (the ad creative), plus the scheduled print runs with internal
-- invoiced/paid tracking. Ad copy + insert orders reuse the existing public
-- `newspaper-ads` Storage bucket (paths copy/<uuid>, insert-orders/<uuid>).
--
-- Apply manually in the Supabase SQL editor (same as 002–011). Idempotent.

CREATE TABLE IF NOT EXISTS public.ads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     text NOT NULL,
  contact_name      text,
  contact_phone     text,
  contact_email     text,
  copy_storage_path text,   -- the ad creative in newspaper-ads
  copy_file_name    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid
);
CREATE INDEX IF NOT EXISTS ads_created_idx ON public.ads (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ad_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id                   uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  date_started            date,
  num_weeks               int,
  price_per_week          numeric(10, 2),
  page_size               text,
  insert_order_path       text,
  insert_order_file_name  text,
  invoiced                boolean NOT NULL DEFAULT false,
  paid                    boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_runs_ad_idx ON public.ad_runs (ad_id, date_started DESC);

-- RLS — editor-tier manage via the migration-006 helper. The admin client
-- (service role) used by the server actions bypasses RLS.
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editors manage ads" ON public.ads;
CREATE POLICY "editors manage ads"
  ON public.ads
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

DROP POLICY IF EXISTS "editors manage ad_runs" ON public.ad_runs;
CREATE POLICY "editors manage ad_runs"
  ON public.ad_runs
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));
