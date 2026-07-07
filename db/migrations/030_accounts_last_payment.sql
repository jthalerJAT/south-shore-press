-- 030_accounts_last_payment.sql
-- Last payment (date + amount) on the master account record, shown in the
-- Account Database under a "Last Payment" heading. Populated by the Stripe
-- webhook (on each paid invoice), by imports, and by the legacy paid-subscriber
-- load.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–029).

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last_payment_date   date,
  ADD COLUMN IF NOT EXISTS last_payment_amount numeric(10,2);
