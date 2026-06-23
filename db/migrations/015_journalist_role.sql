-- 015_journalist_role.sql
-- ----------------------------------------------------------------------------
-- Ensure the 'journalist' role exists in the legacy `user_role` enum.
--
-- The Credentials page writes roles to BOTH `profiles.roles` (text[]) and the
-- legacy single `profiles.role` enum column (synced to the highest-privilege
-- role). The array column accepts any text, but the enum column only accepts
-- declared values. If the v1 enum was created without 'journalist', then
-- saving a journalist-only user — whose highest role is 'journalist' — fails
-- on the enum column, so journalist credentials never persist. This adds the
-- value defensively (no-op if it already exists), mirroring how migration 003
-- added 'reader'.
--
-- Idempotent + manual-apply (Supabase SQL editor), same style as 002–014.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in some
-- Postgres versions. Run this file on its own (the Supabase SQL editor runs it
-- outside an explicit BEGIN/COMMIT, so it succeeds).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  enum_typname text;
BEGIN
  -- Detect the actual enum type backing profiles.role (v1 named it itself).
  SELECT pg_type.typname INTO enum_typname
  FROM pg_type
  JOIN pg_attribute ON pg_attribute.atttypid = pg_type.oid
  JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
  WHERE pg_class.relname = 'profiles'
    AND pg_attribute.attname = 'role'
    AND pg_type.typtype = 'e';

  IF enum_typname IS NOT NULL THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', enum_typname, 'journalist');
    RAISE NOTICE 'Ensured value ''journalist'' exists on enum %', enum_typname;
  ELSE
    RAISE NOTICE 'profiles.role is not an enum (or does not exist) — skipping enum extension';
  END IF;
END $$;
