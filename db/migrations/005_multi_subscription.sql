-- Multiple subscriptions per customer
-- ===================================
-- Migration 005. A customer can now hold several concurrent subscriptions
-- (e.g. their own All-Access plus a gift print sub). `subscription_orders`
-- becomes the authoritative per-subscription record, so it needs the
-- lifecycle fields that previously lived only on the single `profiles` row.
--
-- `profiles.subscription_status` / `subscription_tier` are kept but
-- repurposed as AGGREGATES (recomputed by the webhook from all of a user's
-- orders) for cheap "is this a paying subscriber / what level" checks.
--
-- Apply manually in the Supabase SQL editor (additive, idempotent).

ALTER TABLE public.subscription_orders
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscription_orders
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE public.subscription_orders
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
