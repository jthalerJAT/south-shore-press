-- Multi-role support for profiles
-- ================================
-- v1 used a single `profiles.role` enum column. v2's Credentials page
-- lets admins grant any combination of {Admin, Editor, Journalist}, so
-- a single column won't fit. We add a `roles text[]` column alongside.
--
-- The legacy `role` column stays — v2 keeps it in sync (writes the
-- highest-privilege role from `roles[]` into it) so v1 (still serving
-- southshorepress.vercel.app) keeps reading what it expects.
--
-- ----------
-- 1) Add the array column
-- ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';

-- ----------
-- 2) Backfill from the existing single `role` column. Any profile that
--    already has a role gets its roles array set to [role]. Casts
--    enum -> text and normalizes underscores so 'master_admin' becomes
--    'master admin' (matches the spelling v2's code expects).
-- ----------
UPDATE profiles
SET roles = ARRAY[replace(lower(role::text), '_', ' ')]
WHERE roles = '{}'
  AND role IS NOT NULL;

-- ----------
-- 3) Index for fast role-based filtering (helpful as user count grows)
-- ----------
CREATE INDEX IF NOT EXISTS profiles_roles_gin_idx
  ON profiles USING gin (roles);

-- ----------
-- 4) RLS — let admins read all profiles + update profile roles. v1
--    likely already has policies on `profiles` for the user reading
--    their own row; these are additive (PostgreSQL combines policies
--    with OR), so existing access is preserved.
-- ----------
DROP POLICY IF EXISTS "admins can read all profiles" ON profiles;
CREATE POLICY "admins can read all profiles"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.id = auth.uid()
        AND replace(lower(me.role::text), '_', ' ')
            IN ('admin', 'master admin')
    )
  );

DROP POLICY IF EXISTS "admins can update profile roles" ON profiles;
CREATE POLICY "admins can update profile roles"
  ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.id = auth.uid()
        AND replace(lower(me.role::text), '_', ' ')
            IN ('admin', 'master admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.id = auth.uid()
        AND replace(lower(me.role::text), '_', ' ')
            IN ('admin', 'master admin')
    )
  );
