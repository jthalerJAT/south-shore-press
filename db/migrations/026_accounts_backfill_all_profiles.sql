-- 026_accounts_backfill_all_profiles.sql
-- Corrects the migration 025 backfill. That one filtered to role = 'reader',
-- which skipped everyone who had been given an internal credential (editor /
-- admin / journalist) — but those people also started as digital accounts and
-- belong in the Account Database. This backfills ALL profiles (any role) that
-- aren't already linked to an accounts row.
--
-- The signup trigger (migration 025) already creates an account for every new
-- user regardless of role, so going forward every login appears in BOTH the
-- Credentials tile (profiles) and the Account Database (accounts) — linked by
-- accounts.user_id = profiles.id.
--
-- Idempotent; apply manually in the Supabase SQL editor. Safe to re-run.

INSERT INTO public.accounts (
  account_type, status, first_name, last_name, phone,
  address_1, city, state, zip, email, user_id, source
)
SELECT
  'digital_only', 'active', p.first_name, p.last_name, p.phone,
  p.street_address, p.city, p.state, p.zip_code, p.email, p.id, 'signup'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts a WHERE a.user_id = p.id
);
