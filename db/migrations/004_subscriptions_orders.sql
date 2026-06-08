-- Subscription checkout: orders + webhook plumbing
-- =================================================
-- Migration 004. Adds the table that stores each subscription checkout
-- (delivery + billing addresses, plan tier, Stripe ids, status), a small
-- idempotency table for the Stripe webhook, and the profile snapshot
-- columns the webhook keeps in sync (cancel-at-period-end, period end,
-- the live subscription id).
--
-- Apply manually in the Supabase SQL editor, top to bottom (same as 002 /
-- 003). The SQL editor auto-commits each statement.
--
-- RLS note: every policy that consults `profiles` goes through a
-- SECURITY DEFINER helper — NEVER inline `EXISTS (SELECT FROM profiles ...)`
-- inside a policy, or PG re-triggers the policy and throws 42P17
-- (infinite recursion). See migration 002 for the pattern.

-- ----------
-- 1) Profile snapshot columns the webhook writes.
--    subscription_status / subscription_tier / subscription_started_at
--    already exist from migration 003.
-- ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

-- ----------
-- 2) subscription_orders — one row per checkout attempt. The row is
--    inserted as 'pending' BEFORE the Stripe call so it always exists
--    for reconciliation; the webhook flips it to active/past_due/etc.
--    The active subscription for a user is the row whose
--    stripe_subscription_id matches profiles.stripe_subscription_id.
-- ----------
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier               text NOT NULL
                            CHECK (plan_tier IN ('all_access', 'print_annual', 'print_monthly')),
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'incomplete_expired')),
  stripe_customer_id      text,
  stripe_subscription_id  text UNIQUE,
  stripe_price_id         text,

  -- Delivery address (where the paper ships).
  delivery_first_name  text,
  delivery_last_name   text,
  delivery_company     text,
  delivery_address_1   text,
  delivery_address_2   text,
  delivery_city        text,
  delivery_state       text,
  delivery_zip         text,
  delivery_email       text,
  delivery_phone       text,

  -- Billing address. When billing_same_as_delivery is true the billing_*
  -- columns mirror the delivery_* values (we copy them server-side so a
  -- future export/SimpleCirc push never has to special-case the flag).
  billing_same_as_delivery boolean NOT NULL DEFAULT true,
  billing_first_name  text,
  billing_last_name   text,
  billing_company     text,
  billing_address_1   text,
  billing_address_2   text,
  billing_city        text,
  billing_state       text,
  billing_zip         text,
  billing_email       text,
  billing_phone       text,

  -- Future SimpleCirc fulfillment push bookkeeping (NOT used yet — the
  -- physical-paper sync is a follow-up phase; these are written then).
  simplecirc_synced_at      timestamptz,
  simplecirc_subscriber_id  text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_orders_user_idx
  ON public.subscription_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_orders_sub_idx
  ON public.subscription_orders (stripe_subscription_id);

-- ----------
-- 3) processed_stripe_events — webhook idempotency. The handler does
--    INSERT ... ON CONFLICT DO NOTHING; a zero-row insert means we've
--    already processed this event id and can return 200 early. Stripe
--    redelivers events, so this guards against double-processing.
-- ----------
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id   text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------
-- 4) SECURITY DEFINER admin-read helper (mirrors is_credentials_admin
--    from migration 002). Lets admins read every order row without the
--    policy recursing through profiles.
-- ----------
CREATE OR REPLACE FUNCTION public.is_orders_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND replace(lower(role::text), '_', ' ')
          IN ('admin', 'master admin')
  );
$$;

-- ----------
-- 5) RLS on subscription_orders.
--    - Readers SELECT / INSERT / UPDATE their own rows (the create route
--      runs as the signed-in user).
--    - Admins can read all rows (support / reconciliation).
--    - The Stripe webhook has no user session; it writes via the
--      service-role client (lib/supabase/admin.ts), which bypasses RLS.
-- ----------
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own orders" ON public.subscription_orders;
CREATE POLICY "users read own orders"
  ON public.subscription_orders
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_orders_admin(auth.uid()));

DROP POLICY IF EXISTS "users insert own orders" ON public.subscription_orders;
CREATE POLICY "users insert own orders"
  ON public.subscription_orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own orders" ON public.subscription_orders;
CREATE POLICY "users update own orders"
  ON public.subscription_orders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
