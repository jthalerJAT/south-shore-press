-- 046_admin_stories_ai_thread.sql
-- Master Admin Stories: the AI box is a conversation. The back-and-forth
-- (publisher messages + assistant replies, with a flag on replies that
-- applied an edit) is saved with "Save to Admin Draft" and disposed of when
-- the story is pushed to the Story Editor.
--
-- Idempotent; run in the Supabase SQL editor after 044.

ALTER TABLE public.admin_stories
  ADD COLUMN IF NOT EXISTS ai_thread jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Shape: [{"role":"user"|"assistant","text":"...","at":"ISO","applied":bool?}]
