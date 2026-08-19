-- 044_master_admin_stories.sql
-- MASTER ADMIN credential (singleton) + MASTER ADMIN STORIES.
--
-- Publisher direction 2026-08-17:
--   1) There is exactly ONE master admin: John Thaler's account,
--      jthaler@jatcapital.com. The credential is pinned to that email — no
--      other account can hold it, and it is never grantable from the
--      Credentials page.
--   2) A new "Master Admin Stories" tile is where AI-written drafts (Howard
--      Roark / Gail Wynand / Henry Cameron) first land, and where the master
--      admin writes and keeps his own "Admin Drafts". From there a story is
--      either saved as an Admin Draft or pushed to the Story Editor as a
--      normal draft.
--
-- Idempotent; run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1) Singleton master admin: strip the credential from everyone else.
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET roles = array_remove(array_remove(roles, 'master admin'), 'master_admin')
WHERE lower(email) <> 'jthaler@jatcapital.com'
  AND (roles && ARRAY['master admin', 'master_admin']);

UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) <> 'jthaler@jatcapital.com'
  AND replace(lower(role::text), '_', ' ') = 'master admin';

-- Make sure the pinned account actually carries it (both columns).
UPDATE public.profiles
SET roles = CASE WHEN roles && ARRAY['master admin'] THEN roles ELSE array_append(coalesce(roles, '{}'), 'master admin') END
WHERE lower(email) = 'jthaler@jatcapital.com';

-- ---------------------------------------------------------------------------
-- 2) SQL predicate for RLS: master admin = the pinned email holding the role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_master_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND lower(email) = 'jthaler@jatcapital.com'
      AND (
        replace(lower(role::text), '_', ' ') = 'master admin'
        OR roles && ARRAY['master admin', 'master_admin']
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) admin_stories — the master admin's private story bank.
--    Mirrors the stories table's editable fields so the editor shows the
--    same form; `source` says who created the row; `status` is admin_draft
--    until it is pushed to the Story Editor (then pushed_story_id links the
--    real stories row).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_stories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline          text NOT NULL,
  subline           text,
  byline            text,
  body              text,
  hero_photo_url    text,
  extra_photo_urls  text[] NOT NULL DEFAULT '{}',
  categories        text[] NOT NULL DEFAULT '{}',
  photo_caption     text,
  photo_credit      text,
  source            text NOT NULL DEFAULT 'admin'
                    CHECK (source IN ('ai', 'admin')),
  status            text NOT NULL DEFAULT 'admin_draft'
                    CHECK (status IN ('admin_draft', 'pushed')),
  pushed_story_id   uuid,
  pushed_at         timestamptz,
  created_by        uuid,                 -- NULL for AI-posted rows
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_stories_status_idx
  ON public.admin_stories (status, created_at DESC);

ALTER TABLE public.admin_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master admin manages admin_stories" ON public.admin_stories;
CREATE POLICY "master admin manages admin_stories"
  ON public.admin_stories FOR ALL
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));
-- (The ingest API writes with the service role, which bypasses RLS.)

-- Sanity:
-- SELECT email, role, roles FROM public.profiles WHERE roles && ARRAY['master admin','master_admin'] OR role::text ILIKE 'master%';
-- SELECT count(*) FROM public.admin_stories;
