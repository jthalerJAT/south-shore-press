-- 048_admin_stories_access.sql
-- "Admin Stories" ACCESS CREDENTIAL (publisher direction 2026-09-17).
--
-- Master admin remains a singleton pinned to jthaler@jatcapital.com, but the
-- Master Admin Stories tile becomes shareable via a grantable credential:
-- profiles.roles[] value 'admin stories' (stored like the customer
-- credentials — never in the legacy enum column). Holders can use the tile
-- fully (read AI drafts, edit, AI conversation, save Admin Drafts, push to
-- the Story Editor). The Writing Guidelines editor and everything else
-- master-admin-only stays with the master admin.
--
-- Grantable ONLY by the master admin, from the Credentials page.
--
-- Idempotent; run in the Supabase SQL editor after 044.

-- 1) SQL predicate: master admin OR the access credential.
CREATE OR REPLACE FUNCTION public.has_admin_stories_access(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_master_admin(uid) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND roles && ARRAY['admin stories', 'admin_stories']
  );
$$;

-- 2) admin_stories RLS: access holders manage rows (house_style stays
--    master-admin-only — untouched).
DROP POLICY IF EXISTS "master admin manages admin_stories" ON public.admin_stories;
DROP POLICY IF EXISTS "admin stories access manages admin_stories" ON public.admin_stories;
CREATE POLICY "admin stories access manages admin_stories"
  ON public.admin_stories FOR ALL
  USING (public.has_admin_stories_access(auth.uid()))
  WITH CHECK (public.has_admin_stories_access(auth.uid()));

-- 3) Grant to desk@southshorepress.com: the access credential, plus Editor
--    (modifying/pushing stories writes to the Story Editor, which needs
--    editor-tier rights). Legacy enum column syncs to 'editor' only if the
--    account is currently a plain reader.
UPDATE public.profiles
SET roles = roles || ARRAY['admin stories']
WHERE lower(email) = 'desk@southshorepress.com'
  AND NOT (roles && ARRAY['admin stories', 'admin_stories']);

UPDATE public.profiles
SET roles = roles || ARRAY['editor']
WHERE lower(email) = 'desk@southshorepress.com'
  AND NOT (roles && ARRAY['editor']);

UPDATE public.profiles
SET role = 'editor'
WHERE lower(email) = 'desk@southshorepress.com'
  AND replace(lower(role::text), '_', ' ') = 'reader';

-- Sanity:
-- SELECT email, role, roles FROM public.profiles WHERE lower(email) = 'desk@southshorepress.com';
