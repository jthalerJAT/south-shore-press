-- 038: fourth subscription tier — Introductory Limited Time Offer ($49.99/yr).
-- subscription_orders.plan_tier had a 3-value CHECK from migration 004; add
-- 'intro_annual' so checkout rows for the new plan can be written.
-- Apply manually in the Supabase SQL editor (same as 002+).

ALTER TABLE public.subscription_orders
  DROP CONSTRAINT IF EXISTS subscription_orders_plan_tier_check;
ALTER TABLE public.subscription_orders
  ADD CONSTRAINT subscription_orders_plan_tier_check
  CHECK (plan_tier IN ('all_access', 'print_annual', 'print_monthly', 'intro_annual'));
