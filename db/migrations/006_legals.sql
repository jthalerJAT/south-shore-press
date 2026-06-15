-- Legals: public legal-notice PDFs + notarized-copy requests
-- ===========================================================
-- Migration 006. Two tables:
--   legals                  — one row per uploaded legal-notice PDF
--                             (editor-designated date + storage path).
--                             PUBLIC read (legal notices are statutory
--                             public records); writes via the service-role
--                             client only (editor-gated server actions).
--   notarized_copy_requests — public "Request Notarized Copy" submissions.
--                             Inserted via the service-role client in the
--                             public form's server action; readable by
--                             editor-tier only.
--
-- Apply manually in the Supabase SQL editor (same as 002–005). Also create
-- a PUBLIC Storage bucket named `legals` (Dashboard → Storage → New bucket →
-- Public) for the PDF files.
--
-- RLS note: the is_editor_tier() check is a SECURITY DEFINER function so a
-- policy never inlines EXISTS over profiles (avoids 42P17 recursion — see
-- migration 002).

-- ----------
-- 1) legals
-- ----------
CREATE TABLE IF NOT EXISTS public.legals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_date   date NOT NULL,
  storage_path text NOT NULL,
  file_name    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS legals_date_idx ON public.legals (legal_date DESC);

-- ----------
-- 2) notarized_copy_requests
-- ----------
CREATE TABLE IF NOT EXISTS public.notarized_copy_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  address             text,
  email               text NOT NULL,
  phone               text,
  legal_ad_requested  text,
  notes               text,
  legal_id            uuid REFERENCES public.legals(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notarized_requests_created_idx
  ON public.notarized_copy_requests (created_at DESC);

-- ----------
-- 3) Editor-tier SECURITY DEFINER helper (editor / admin / master admin).
--    Checks both the legacy single `role` enum and the modern `roles[]`.
-- ----------
CREATE OR REPLACE FUNCTION public.is_editor_tier(uid uuid)
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
        replace(lower(role::text), '_', ' ') IN ('editor', 'admin', 'master admin')
        OR roles && ARRAY['editor', 'admin', 'master admin']
      )
  );
$$;

-- ----------
-- 4) RLS
--    legals: anyone can SELECT (public records). Writes only via the
--      service-role client (no INSERT/UPDATE/DELETE policy).
--    notarized_copy_requests: editor-tier can SELECT. Inserts only via the
--      service-role client in the public form's action.
-- ----------
ALTER TABLE public.legals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read legals" ON public.legals;
CREATE POLICY "anyone can read legals"
  ON public.legals
  FOR SELECT
  USING (true);

ALTER TABLE public.notarized_copy_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "editors read notarized requests" ON public.notarized_copy_requests;
CREATE POLICY "editors read notarized requests"
  ON public.notarized_copy_requests
  FOR SELECT
  USING (public.is_editor_tier(auth.uid()));
