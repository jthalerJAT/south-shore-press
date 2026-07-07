-- 025_accounts_from_signups.sql
-- Digital signups → Account Database. When a reader registers on the site they
-- should appear in the Account Database as a "Digital Only (free)" account.
--
-- Two parts:
--   1) Extend the existing signup trigger (handle_new_auth_user, migration 003)
--      so it also creates a digital_only accounts row for every new user.
--   2) Backfill the readers we already have (role = 'reader') who aren't yet in
--      the accounts table.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–024).
-- No ALTER TYPE here, so it's safe to run as one block.

-- 1) Trigger: create the profile AND a linked digital_only account.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := NEW.raw_user_meta_data->>'first_name';
  v_last  text := NEW.raw_user_meta_data->>'last_name';
  v_display text;
BEGIN
  v_display := NULLIF(TRIM(COALESCE(v_first, '') || ' ' || COALESCE(v_last, '')), '');

  INSERT INTO public.profiles (
    id, email, role, roles, display_name,
    first_name, last_name, phone,
    street_address, city, state, zip_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    'reader',                          -- no ::text cast; PG resolves to the enum
    ARRAY['reader']::text[],
    v_display,
    v_first,
    v_last,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'street_address',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'zip_code'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Digital signup → Account Database (Digital Only / free). Guarded so a
  -- replayed insert never duplicates the account (no unique key on user_id).
  INSERT INTO public.accounts (
    account_type, status, first_name, last_name, phone,
    address_1, city, state, zip, email, user_id, source
  )
  SELECT
    'digital_only', 'active', v_first, v_last,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'street_address',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'zip_code',
    NEW.email, NEW.id, 'signup'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE user_id = NEW.id
  );

  RETURN NEW;
END;
$$;

-- (Trigger on_auth_user_created already points at this function — no need to
--  recreate it.)

-- 2) Backfill existing readers not yet represented in the accounts table.
--    Scoped to role = 'reader' so newsroom staff (editors/admins) are excluded.
INSERT INTO public.accounts (
  account_type, status, first_name, last_name, phone,
  address_1, city, state, zip, email, user_id, source
)
SELECT
  'digital_only', 'active', p.first_name, p.last_name, p.phone,
  p.street_address, p.city, p.state, p.zip_code, p.email, p.id, 'signup'
FROM public.profiles p
WHERE p.role = 'reader'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.user_id = p.id
  );
