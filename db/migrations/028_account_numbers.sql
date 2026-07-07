-- 028_account_numbers.sql
-- Assign every account a stable account number. Imported records keep their
-- original number (from the source spreadsheet); everyone else gets a fresh one.
--
-- New numbers start at 1,000,000 (7 digits). The imported SimpleCirc numbers are
-- 8 digits (≥ ~21,000,000), so the two ranges never collide.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–027).

CREATE SEQUENCE IF NOT EXISTS public.accounts_account_number_seq
  START WITH 1000000 INCREMENT BY 1;

-- Auto-assign to any account inserted WITHOUT an explicit number (signup
-- trigger, admin "New Account", Stripe-created rows). Rows that supply their own
-- number (imports) keep it, because an explicit value overrides the default.
ALTER TABLE public.accounts
  ALTER COLUMN account_number SET DEFAULT nextval('public.accounts_account_number_seq')::text;

-- Backfill existing accounts that have no number yet (digital signups, staff,
-- etc.). Imported numbers are preserved.
UPDATE public.accounts
  SET account_number = nextval('public.accounts_account_number_seq')::text
  WHERE account_number IS NULL OR account_number = '';

-- Called after an import to number any rows that arrived without one (e.g. a
-- paid-subscriber file that had no account-id column). Returns how many it set.
CREATE OR REPLACE FUNCTION public.assign_missing_account_numbers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH updated AS (
    UPDATE public.accounts
      SET account_number = nextval('public.accounts_account_number_seq')::text
      WHERE account_number IS NULL OR account_number = ''
      RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  RETURN n;
END;
$$;
