-- 047_digital_papers.sql
-- DIGITAL PAPER — a web-friendly PDF of every printed issue, newest first,
-- in the editor portal (view / print / download / share by link). Not the
-- high-res press file; these are compressed for screens and email.
--
--   digital_papers   one row per issue (unique issue_date)
--   digital-papers   public Storage bucket holding the PDFs (public URLs so
--                    staff can email links to each other)
--
-- Idempotent; run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.digital_papers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date      date NOT NULL UNIQUE,
  storage_path    text NOT NULL,
  file_name       text,
  page_count      int,
  file_size_bytes bigint,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_papers_date_idx
  ON public.digital_papers (issue_date DESC);

ALTER TABLE public.digital_papers ENABLE ROW LEVEL SECURITY;

-- Editor-tier reads and writes (uploads/records go through the service-role
-- server actions; this policy covers the portal page's list query).
DROP POLICY IF EXISTS "editor tier manages digital_papers" ON public.digital_papers;
CREATE POLICY "editor tier manages digital_papers"
  ON public.digital_papers FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

-- Public bucket (same model as `legals`): objects are written only via
-- service-role signed upload URLs; anyone with a link can read.
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-papers', 'digital-papers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Sanity:
-- SELECT issue_date, file_name, page_count, file_size_bytes FROM public.digital_papers ORDER BY issue_date DESC;
