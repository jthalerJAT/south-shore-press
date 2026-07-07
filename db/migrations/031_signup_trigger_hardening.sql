-- 031_signup_trigger_hardening.sql
-- Make the account-mirror step of the signup trigger NON-FATAL. The profile
-- row is essential; the accounts mirror is secondary and must never be able to
-- roll back a new user's signup. On failure it logs the real error (SQLERRM) as
-- a WARNING so the underlying cause is visible in the Postgres logs, and the
-- account gets picked up by the profiles backfill (migration 026) regardless.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–030).

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
    'reader',
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

  -- Secondary: mirror into the Account Database. Wrapped so a failure here can
  -- NEVER block signup — it just logs and moves on.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user: account mirror failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
