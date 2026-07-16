-- 036_reader_baseline.sql
-- Reader becomes an explicit, universal credential + accounts become deletable.
--
--   1. Every profile holds 'reader' in roles[] — always. Revoking editorial
--      credentials leaves a plain reader, never a role-less row whose access
--      silently falls back to the legacy `role` column (the drift that let a
--      de-credentialed journalist keep publishing, 2026-07-15/16).
--   2. The legacy `role` column is resynced: reader-only accounts read
--      'reader' there too, so v1 and every RLS policy agree with the UI.
--   3. Foreign keys are made deletion-safe so an admin can remove an account
--      entirely from the Credentials page (auth user deleted → profile row
--      cascades → stories survive with author_id cleared).
--
-- The signup trigger (031) already grants role='reader' + roles=['reader']
-- to every new account — no trigger change needed.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002-035).

-- ── 1. Every account holds the reader credential ────────────────────────────
UPDATE public.profiles
SET roles = array_append(COALESCE(roles, '{}'::text[]), 'reader')
WHERE NOT ('reader' = ANY(COALESCE(roles, '{}'::text[])));

-- ── 2. Resync the legacy role column ────────────────────────────────────────
-- Anyone whose credentials are reader-only must read 'reader' in the legacy
-- column too (clears the pre-56fbb0f "demoted to journalist" drift). Rows
-- with real editorial roles are left alone — the app keeps those in sync on
-- every save.
UPDATE public.profiles
SET role = 'reader'
WHERE NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(roles, '{}'::text[])) AS r
    WHERE replace(lower(r), '_', ' ') IN ('journalist', 'editor', 'admin', 'master admin')
  )
  AND replace(lower(role::text), '_', ' ') IS DISTINCT FROM 'reader';

-- ── 3. Deletion-safe foreign keys ───────────────────────────────────────────
-- 3a. profiles.id must CASCADE when the auth user is deleted (the delete
--     action removes the auth.users row via the service role). The original
--     constraint name is v1-era and unknown — drop whatever FK points at
--     auth.users, then recreate it with CASCADE.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- 3b. Stories must SURVIVE their author's deletion — published journalism is
--     the paper's record, not the author's property. author_id clears to NULL.
ALTER TABLE public.stories ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_author_id_fkey;
ALTER TABLE public.stories
  ADD CONSTRAINT stories_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3c. Site-layout pins reference who last pinned — informational only.
ALTER TABLE public.site_layout_pins DROP CONSTRAINT IF EXISTS site_layout_pins_updated_by_fkey;
ALTER TABLE public.site_layout_pins
  ADD CONSTRAINT site_layout_pins_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- (Other user references already behave on delete: subscription orders
-- CASCADE with the account [004]; accounts.user_id, legals/classifieds/
-- legal_notices created_by all SET NULL [023, 006, 018, 034].)

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Every row should show 'reader' in roles[], and reader-only rows should
-- show role='reader':
--   SELECT email, role, roles FROM public.profiles ORDER BY email;
