-- Reader self-signup support
-- ===========================
-- Migration 003. Adds the columns + role tier + auth trigger needed
-- for public-facing readers to register their own accounts via /signup.
--
-- DO NOT wrap this whole file in a transaction in Supabase Studio:
-- ALTER TYPE ADD VALUE creates an enum value that cannot be USED in
-- the same transaction it was added in. Supabase SQL Editor auto-
-- commits each statement, which is the right behavior here. If you
-- need to re-run pieces manually, run section by section in order.
--
-- v1 compat note: 'reader' is added to the enum but v1 (the Vite SPA)
-- never reads readers since they have no editorial permissions. Any
-- v1 code that gates on role compares to known editor-tier values and
-- treats unknowns as no-access, which is correct for readers.

-- ----------
-- 1) Extend the role enum with 'reader' (defensive — detects the
--    actual type name at runtime since v1 named it without telling us)
-- ----------
DO $$
DECLARE
  enum_typname text;
BEGIN
  SELECT pg_type.typname INTO enum_typname
  FROM pg_type
  JOIN pg_attribute ON pg_attribute.atttypid = pg_type.oid
  JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
  WHERE pg_class.relname = 'profiles'
    AND pg_attribute.attname = 'role'
    AND pg_type.typtype = 'e';

  IF enum_typname IS NOT NULL THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', enum_typname, 'reader');
    RAISE NOTICE 'Added value ''reader'' to enum %', enum_typname;
  ELSE
    RAISE NOTICE 'profiles.role is not an enum (or does not exist) — skipping enum extension';
  END IF;
END $$;

-- ----------
-- 2) Reader profile columns
--    Address split into 4 fields (street/city/state/zip) to match the
--    GPC pattern + make per-field validation simpler later.
-- ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code text;

-- Stripe payment-method snapshot. Populated when the user adds a card
-- via /account → Payment. The actual PaymentMethod ID lives in Stripe;
-- we cache last4 + brand for UI rendering and a boolean to gate
-- "Add card" vs "Update card" UI.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_payment_method boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_method_last4 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_method_brand text;

-- Subscription snapshot. Populated by the Stripe webhook (not built
-- yet — TODO). 'free' / 'active' / 'canceled' / 'past_due' etc.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz;

-- Created_at — useful for "signup date" in the admin Readers table.
-- May already exist from v1's schema; IF NOT EXISTS handles both cases.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles (created_at DESC);

-- ----------
-- 3) Auto-create a profile row when a new auth user signs up.
--    SECURITY DEFINER so the trigger can INSERT into public.profiles
--    even though the inserting role (Supabase Auth) doesn't normally
--    have permission. raw_user_meta_data is populated by the /signup
--    server action via supabase.auth.signUp({ options: { data: {...} } }).
-- ----------
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------
-- 4) RLS — readers can read/update their own profile row.
--    Editor-tier admin policies are unchanged from migration 002.
--    The UPDATE policy doesn't column-gate (PG can't); we rely on the
--    server-action layer to only SET non-privileged columns when
--    invoked by a non-admin.
-- ----------
DROP POLICY IF EXISTS "users can read own profile" ON profiles;
CREATE POLICY "users can read own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users can update own profile" ON profiles;
CREATE POLICY "users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
