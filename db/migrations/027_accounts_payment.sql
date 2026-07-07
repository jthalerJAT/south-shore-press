-- 027_accounts_payment.sql
-- Payment snapshot on the master account record, so the Account Database holds
-- the card-on-file (brand + last 4) for paid subscribers — part of making
-- accounts the single source of truth for customer + payment info.
--
-- (stripe_customer_id, stripe_subscription_id, subscription_start/end already
--  exist on accounts from migration 023.)
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–026).

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS has_payment_method   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method_last4 text,
  ADD COLUMN IF NOT EXISTS payment_method_brand text;
