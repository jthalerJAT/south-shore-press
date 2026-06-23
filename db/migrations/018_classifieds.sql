-- 018_classifieds.sql
-- ----------------------------------------------------------------------------
-- Classified uploads — mirrors the legals feature (migration 006). Editors
-- upload a classified PDF; it's stored in the `classifieds` Storage bucket and
-- listed here. The Newspaper Creator's classifieds pages then let an editor
-- pick/drop an uploaded classified onto the page.
--
-- Unlike legals (public), classifieds are an internal production asset, so
-- SELECT is editor-tier (not public). Inserts/deletes go through the
-- service-role admin client in the portal actions (bypasses RLS), same as
-- legals — so only a SELECT policy is needed for the user-client reads.
--
-- Idempotent + manual-apply (Supabase SQL editor), same style as 006/016/017.
-- After applying, create a PUBLIC Storage bucket named `classifieds`.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.classifieds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classified_date  date NOT NULL,
  storage_path     text NOT NULL,
  file_name        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS classifieds_date_idx ON public.classifieds (classified_date DESC);

ALTER TABLE public.classifieds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editors read classifieds" ON public.classifieds;
CREATE POLICY "editors read classifieds"
  ON public.classifieds
  FOR SELECT
  USING (public.is_editor_tier(auth.uid()));
