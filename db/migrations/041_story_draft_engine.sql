-- 041_story_draft_engine.sql
-- STORY DRAFT ENGINE: human-in-the-loop AI drafting.
--
-- The newsroom pipeline stops posting finished drafts. Instead it posts STORY
-- CANDIDATES (a dual-sourced subject + extracted facts) to
-- /api/ingest/candidate. An editor opens the Story Draft Engine in the portal,
-- includes/excludes each fact, types per-fact angle language, picks a byline,
-- and generates the article (Claude call from the site server). The article
-- can be regenerated with further instructions, then moved to the Story
-- Editor as a normal draft — at which point the candidate leaves the engine.
--
--   story_candidates — one row per dual-sourced subject; carries the latest
--                      generated article until it's moved to drafts
--   candidate_facts  — the fact menu; added_by NULL = machine-extracted,
--                      set = typed by an editor ("+ Add Fact")
--   writers          — centralized writer/persona profiles (bylines + voice)
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002-040).

CREATE TABLE IF NOT EXISTS public.story_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline          text NOT NULL,
  summary           text,
  section           text,                 -- suggested site section slug
  suggested_byline  text,
  sources           jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{outlet, title, url}]
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'generated', 'drafted', 'deleted')),
  -- Latest generated article (kept here until moved to drafts)
  article_headline  text,
  article_subline   text,
  article_body      text,
  byline            text,                 -- byline chosen at generation time
  drafted_story_id  uuid,                 -- stories.id once moved to drafts
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_candidates_status_idx
  ON public.story_candidates (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.candidate_facts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES public.story_candidates(id) ON DELETE CASCADE,
  fact          text NOT NULL,
  source_label  text,                     -- outlet attribution, e.g. "Newsday"
  fact_order    int NOT NULL DEFAULT 0,
  added_by      uuid,                     -- NULL = machine-extracted
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_facts_candidate_idx
  ON public.candidate_facts (candidate_id, fact_order);

-- Centralized writer profiles — the "writers/ folder" as data, shared by the
-- site's generation prompt and (eventually) the pipeline.
CREATE TABLE IF NOT EXISTS public.writers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,       -- byline
  desk        text,                       -- e.g. local / nation-world / business
  persona     text,                       -- voice + rules injected into the prompt
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.writers (name, desk, persona)
VALUES
  ('Gail Wynand', 'nation-world',
   'National/world desk. Straight news, AP style, inverted pyramid, 500-700 words. Facts only from the provided material - never from memory. Neutral, precise, no opinion unless the editor''s angle notes direct it.'),
  ('Henry Cameron', 'local',
   'Local desk for Suffolk County and NY State. Community-paper voice: plain, direct, service-minded. AP style, inverted pyramid, ~300-500 words. Facts only from the provided material.'),
  ('Howard Roark', 'business',
   'Business desk. Markets and economy explained for a general Long Island readership - concrete numbers, plain language, why-it-matters framing. AP style, 400-600 words. Facts only from the provided material.')
ON CONFLICT (name) DO NOTHING;

-- RLS: editor-tier manages all three; the candidate ingest endpoint and the
-- generation action use the service-role client.
ALTER TABLE public.story_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editors manage story_candidates" ON public.story_candidates;
CREATE POLICY "editors manage story_candidates"
  ON public.story_candidates FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

DROP POLICY IF EXISTS "editors manage candidate_facts" ON public.candidate_facts;
CREATE POLICY "editors manage candidate_facts"
  ON public.candidate_facts FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

DROP POLICY IF EXISTS "editors manage writers" ON public.writers;
CREATE POLICY "editors manage writers"
  ON public.writers FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));
