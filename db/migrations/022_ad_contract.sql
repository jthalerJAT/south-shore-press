-- 022_ad_contract.sql
-- Contract PDF on the advertiser (ad) — a separate document from the insert
-- order (migration 021). Captured on the "Upload New Ad" form and the ad detail
-- view, directly below the insert order. Reuses the public `newspaper-ads`
-- Storage bucket (path contracts/<uuid>) — no new bucket needed.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–021).

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS contract_path      text,
  ADD COLUMN IF NOT EXISTS contract_file_name text;

-- RLS unchanged: the existing "editors manage ads" policy covers the new columns.
