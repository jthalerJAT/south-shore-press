-- 042_writer_models.sql
-- Per-writer LLM choice for the Story Draft Engine. writers.model names the
-- model that drafts for that byline ('claude-sonnet-5', 'grok-4', ...); the
-- provider is inferred from the name (grok-* → xAI via XAI_API_KEY,
-- claude-* → Anthropic via ANTHROPIC_API_KEY). NULL falls back to the
-- engine default (env DRAFT_ENGINE_MODEL, else claude-sonnet-5).
--
-- Run AFTER 041. Idempotent; apply manually in the Supabase SQL editor.

ALTER TABLE public.writers
  ADD COLUMN IF NOT EXISTS model text;

-- To put a desk on Grok, e.g.:
--   UPDATE public.writers SET model = 'grok-4' WHERE name = 'Howard Roark';
-- Or every desk:
--   UPDATE public.writers SET model = 'grok-4';
