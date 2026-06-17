-- Newspaper Creator — print layout templates (Phase 7, InDesign export)
-- ===================================================================
-- Migration 010. A reusable "master InDesign template" per page kind, stored
-- as a layout spec (frames in points + type styles + content bindings). The
-- UXP plugin builds the InDesign page from spec + content data.
--
-- Optional: the print API falls back to the built-in FRONT_PRINT_SPEC
-- (lib/newspaper/print-templates.ts) when no row exists here, so this table
-- only needs rows once an editor wants to override/tune a layout in the DB.
--
-- Apply manually in the Supabase SQL editor (same as 002–009). Idempotent.

CREATE TABLE IF NOT EXISTS public.np_print_templates (
  kind        text PRIMARY KEY,
  spec        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.np_print_templates ENABLE ROW LEVEL SECURITY;

-- Editor-tier manage via the migration-006 helper. The print API reads via the
-- service-role client (token-guarded), which bypasses RLS.
DROP POLICY IF EXISTS "editors manage np_print_templates" ON public.np_print_templates;
CREATE POLICY "editors manage np_print_templates"
  ON public.np_print_templates
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));
