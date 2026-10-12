-- 052_edit_lock_session.sql
-- SAME LOGIN, TWO TERMINALS (publisher workflow 2026-10-12): the edit lock in
-- 051 identifies the holder by USER, so one person signed in on two machines
-- (or two browser windows) counted as the same holder — both could edit the
-- same page and overwrite each other, which is the exact failure the lock was
-- built to stop.
--
-- The claim now also records WHICH WINDOW holds it. A second window — yours or
-- anyone else's — gets the read-only banner.
--
-- Idempotent; run in the Supabase SQL editor. Until it is applied the app
-- falls back to 051 behaviour (locking between different people only).

ALTER TABLE public.np_edit_locks
  ADD COLUMN IF NOT EXISTS session_id text;

-- Sanity:
-- SELECT scope, user_name, session_id, claimed_at, last_seen_at
--   FROM public.np_edit_locks;
