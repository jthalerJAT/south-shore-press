-- 051_edit_locks.sql
-- ONE EDITOR AT A TIME (publisher direction 2026-10-12): whole-page editors
-- save the page as a single blob, so two people with the same page open meant
-- the last save silently overwrote the first (observed on the Election
-- Coverage section, where EVERY election page edits the same stored section).
--
-- A page is CLAIMED when someone opens its editor. Anyone else who opens it
-- gets a read-only view naming the holder. The claim is released when the
-- holder closes the tab, and expires after 60 minutes without a heartbeat (a
-- crashed browser can't hold a page hostage; a holder who steps away keeps it
-- as long as the tab stays open). There is no takeover button by design.
--
-- Idempotent; run in the Supabase SQL editor. The app degrades gracefully
-- while this is unapplied: everyone keeps full edit access, as today.

CREATE TABLE IF NOT EXISTS public.np_edit_locks (
  -- 'page:<uuid>' for a single page; 'election:<variant>' for the shared
  -- Election Coverage section (all its pages edit one stored section).
  scope         text PRIMARY KEY,
  user_id       uuid NOT NULL,
  user_name     text,
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS np_edit_locks_last_seen_idx
  ON public.np_edit_locks (last_seen_at);

ALTER TABLE public.np_edit_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editor tier manages np_edit_locks" ON public.np_edit_locks;
CREATE POLICY "editor tier manages np_edit_locks"
  ON public.np_edit_locks FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

-- Sanity:
-- SELECT scope, user_name, claimed_at, last_seen_at FROM public.np_edit_locks;
-- DELETE FROM public.np_edit_locks WHERE scope = 'page:<uuid>';  -- manual release
