-- 020_stories_fulltext_search.sql
-- ----------------------------------------------------------------------------
-- Full-text search for the public header search bar (/search?q=...).
--
-- Adds a generated `fts` tsvector over headline + subline + byline + body and
-- a GIN index, so `websearch_to_tsquery` lookups are fast and handle multi-word
-- queries (AND of terms, quoted phrases, negation) the way readers expect.
--
-- The column is GENERATED ALWAYS … STORED, so it stays in sync automatically on
-- every insert/update — no triggers, no app changes to maintain it.
--
-- Idempotent + manual-apply (Supabase SQL editor), same style as 002–019.
-- ----------------------------------------------------------------------------

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(headline, '') || ' ' ||
      coalesce(subline, '')  || ' ' ||
      coalesce(byline, '')   || ' ' ||
      coalesce(body, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS stories_fts_idx ON public.stories USING gin (fts);
