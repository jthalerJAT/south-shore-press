-- 016_journalist_story_rls.sql
-- ----------------------------------------------------------------------------
-- Let JOURNALISTS create/manage their OWN stories.
--
-- Symptom: a journalist hitting "Publish" (or Save) on the New Story form got
--   "new row violates row-level security policy for table 'stories'"
-- The v1 `stories` RLS policies only allow the editor tier
-- (editor/admin/master admin) to write. Journalists are recognized by the app
-- but blocked by Postgres RLS at insert time.
--
-- Fix: add a `is_contributor()` helper (journalist + editor tier) and ADDITIVE
-- permissive policies that let a contributor SELECT/INSERT/UPDATE/DELETE rows
-- where they are the author. RLS permissive policies are OR-combined, so these
-- sit alongside the existing editor-tier policies without altering them — an
-- editor still manages everything; a journalist now manages only their own.
--
-- The `author_id = auth.uid()` check keeps journalists scoped to their own work
-- (matching the app-level checks in app/portal/actions.ts) and the
-- is_contributor() gate keeps plain readers from inserting stories.
--
-- Idempotent + manual-apply (Supabase SQL editor), same style as 002–015.
-- ----------------------------------------------------------------------------

-- 1) Contributor = journalist OR editor tier. SECURITY DEFINER so the policy
--    never inlines EXISTS over profiles (avoids 42P17 recursion — same pattern
--    as is_editor_tier in migration 006). Checks BOTH the legacy single `role`
--    enum and the modern `roles[]` array.
CREATE OR REPLACE FUNCTION public.is_contributor(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND (
        replace(lower(role::text), '_', ' ') IN ('journalist', 'editor', 'admin', 'master admin')
        OR roles && ARRAY['journalist', 'editor', 'admin', 'master admin']
      )
  );
$$;

-- 2) Journalist-own policies on stories (additive — existing editor policies
--    are left in place and OR-combined with these).
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contributors read own stories" ON public.stories;
CREATE POLICY "contributors read own stories"
  ON public.stories
  FOR SELECT
  USING (author_id = auth.uid() AND public.is_contributor(auth.uid()));

DROP POLICY IF EXISTS "contributors insert own stories" ON public.stories;
CREATE POLICY "contributors insert own stories"
  ON public.stories
  FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_contributor(auth.uid()));

DROP POLICY IF EXISTS "contributors update own stories" ON public.stories;
CREATE POLICY "contributors update own stories"
  ON public.stories
  FOR UPDATE
  USING (author_id = auth.uid() AND public.is_contributor(auth.uid()))
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "contributors delete own stories" ON public.stories;
CREATE POLICY "contributors delete own stories"
  ON public.stories
  FOR DELETE
  USING (author_id = auth.uid() AND public.is_contributor(auth.uid()));
