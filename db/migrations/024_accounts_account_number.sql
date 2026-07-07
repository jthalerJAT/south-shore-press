-- 024_accounts_account_number.sql
-- Preserve the original "Subscriber Account ID" from imported mailer lists so
-- the weekly label-file export reproduces it exactly (it's also embedded in the
-- ACS Keyline). Distinct from the table's own uuid `id`.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–023).

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_number text;

CREATE INDEX IF NOT EXISTS accounts_account_number_idx ON public.accounts (account_number);
