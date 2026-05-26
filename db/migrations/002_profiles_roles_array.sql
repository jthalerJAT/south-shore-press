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
-- 4) RLS — let admins read all profiles + update profile roles.
--
-- DO NOT inline `EXISTS (SELECT FROM profiles ...)` inside a policy
-- ON profiles. PostgreSQL re-triggers the same SELECT policy on the
-- inner query and detects infinite recursion (error 42P17), which
-- kills every query that touches profiles — directly OR indirectly
-- through joins / other policies that consult profiles.
--
-- Fix: wrap the admin check in a SECURITY DEFINER function. The
-- function runs as its owner (postgres / table owner) and skips RLS
-- on its inner SELECT, breaking the recursion. The function is also
-- STABLE + search_path-locked for safety.
-- ----------
CREATE OR REPLACE FUNCTION public.is_credentials_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND replace(lower(role::text), '_', ' ')
          IN ('admin', 'master admin')
  );
$$;

DROP POLICY IF EXISTS "admins can read all profiles" ON profiles;
CREATE POLICY "admins can read all profiles"
  ON profiles
  FOR SELECT
  USING (public.is_credentials_admin(auth.uid()));

DROP POLICY IF EXISTS "admins can update profile roles" ON profiles;
CREATE POLICY "admins can update profile roles"
  ON profiles
  FOR UPDATE
  USING (public.is_credentials_admin(auth.uid()))
  WITH CHECK (public.is_credentials_admin(auth.uid()));
