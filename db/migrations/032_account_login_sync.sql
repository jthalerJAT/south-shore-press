-- 032_account_login_sync.sql
-- Keep the Account Database automatically in sync with Supabase logins.
-- No buttons, no page-load reconcile — the database itself maintains the
-- invariant:
--
--   1) signup       → account row created (or an orphaned row with the same
--                     email re-linked, so delete/re-signup never duplicates)
--   2) user deleted → their digital-only signup row is deleted in the same
--                     transaction. Paid / imported / manual / mailer rows are
--                     preserved (a paid subscriber's mailing record must
--                     survive login removal; the FK just unlinks it).
--   3) one-time cleanup of drift that already happened (test-era orphans).
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–031).

-- 1) Signup trigger: create-or-relink, mirror step non-fatal.
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
    NEW.id, NEW.email, 'reader', ARRAY['reader']::text[], v_display,
    v_first, v_last,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'street_address',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'zip_code'
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    -- Re-link an orphaned account (same email, no login) from a previous
    -- delete/re-signup cycle instead of creating a duplicate.
    UPDATE public.accounts
      SET user_id = NEW.id, updated_at = now()
      WHERE user_id IS NULL AND lower(email) = lower(NEW.email);

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
    WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user: account mirror failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 2) Delete trigger: BEFORE DELETE (the FK would null user_id before an AFTER
--    trigger could see it). Removes only the digital-only signup mirror; any
--    paid / imported / manual / mailer record survives and simply unlinks.
CREATE OR REPLACE FUNCTION public.handle_deleted_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    DELETE FROM public.accounts
      WHERE user_id = OLD.id
        AND account_type = 'digital_only'
        AND source = 'signup';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_deleted_auth_user: account cleanup failed for %: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_auth_user();

-- 3) One-time cleanup of existing drift:
--    a) re-link orphans to a login with the same email (if that login has no
--       account yet) — preserves paid history;
UPDATE public.accounts a
SET user_id = p.id, updated_at = now()
FROM public.profiles p
WHERE a.user_id IS NULL
  AND a.email IS NOT NULL
  AND lower(a.email) = lower(p.email)
  AND NOT EXISTS (SELECT 1 FROM public.accounts x WHERE x.user_id = p.id);

--    b) remove digital-only signup orphans whose login no longer exists.
DELETE FROM public.accounts
WHERE user_id IS NULL
  AND source = 'signup'
  AND account_type = 'digital_only';
