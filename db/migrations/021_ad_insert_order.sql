-- 021_ad_insert_order.sql
-- Insert Order on the advertiser (ad) itself — the signed PDF contract with the
-- customer. Distinct from the per-run insert order on `ad_runs` (migration 012):
-- this one travels with the advertiser and is captured on the "Upload New Ad"
-- form alongside the copy. Reuses the public `newspaper-ads` Storage bucket
-- (path insert-orders/<uuid>), same as run-level insert orders.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–020).

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS insert_order_path      text,
  ADD COLUMN IF NOT EXISTS insert_order_file_name text;

-- RLS unchanged: the existing "editors manage ads" policy covers the new columns.
