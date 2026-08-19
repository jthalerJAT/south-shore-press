-- 045_house_style.sql
-- HOUSE WRITING GUIDELINES — one editable document every AI writing path
-- reads at run time (the site's Master Admin AI-revise box directly; the
-- office-PC desks — Howard Roark, Gail Wynand, Henry Cameron — via
-- GET /api/house-style at the start of each run, with a local cached copy
-- as fallback). Edited from Master Admin Stories → Writing Guidelines.
--
-- Precedence (encoded in the prompt framing, not here): these apply to all
-- AI-written content; each writer's own VOICE instructions supersede them
-- where they conflict; for straight news (Gail Wynand local desk) only the
-- guidelines compatible with facts-only reporting apply.
--
-- Idempotent; run in the Supabase SQL editor after 044.

CREATE TABLE IF NOT EXISTS public.house_style (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

ALTER TABLE public.house_style ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master admin manages house_style" ON public.house_style;
CREATE POLICY "master admin manages house_style"
  ON public.house_style FOR ALL
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));
-- (Server-side reads use the service role, which bypasses RLS.)

INSERT INTO public.house_style (key, content)
VALUES ('writing_guidelines', $guidelines$
1) Thought Flow Correction

"This isn't a grammatical correction. It's a reasoning correction. Rewrite it so the ideas move like a real mind: irregular in some places, straight to the point in others, sometimes slower.

Break any pattern where the writing feels too controlled."

2) The Pattern Breaker

"You're an expert at spotting the tells that give away AI-generated text. Go through this piece and wipe them out, one by one. Shake up the structure, ease out any stiff phrasing, and make every word feel like it was picked right then and there, not churned out by some formula."

3) The Credibility Test

"You're a reader who immediately distrusts texts that seem too polished. Go sentence by sentence and rewrite anything that feels overly constructed, overly corrected, or too precise.

It should sound like something a real person said out loud without second-guessing every word."

4) The Voice Shaper

"You're building a voice that seems to belong to a real person. Rewrite it to carry a clear point of view, not the tone of a neutral observer trying to please everyone.

Let opinions, small contradictions, and natural shifts in tone appear."

5) The Imperfections Injector

"Perfect texts have no history. Rewrite by adding micro-imperfections that only someone who has lived the subject would write: a strong opinion here, a hesitation there, an incomplete sentence where it makes sense.

Do not correct afterward."

6) The Audio Test

"Read this text out loud in your head. Mark each sentence where you would make a strange pause or where the rhythm would break in a real conversation.

Rewrite those sentences so that the entire text flows like human speech, not like a document."

7) The Soul Detector

"Read this text as if you've already seen thousands of AI-generated texts. Identify the 3 sentences that sound the most artificial and rewrite each one as if the author were talking to a close friend.

No filter. No perfection."

8) Avoid AI Slop

"Given the amount of AI generated content on the internet, humans are growing increasingly wary of "AI Slop". Do not produce AI Slop, and once an article is created, read it to check whether it appears to be AI Slop and make edits to avoid that appearance."
$guidelines$)
ON CONFLICT (key) DO NOTHING;

-- Sanity:
-- SELECT key, length(content), updated_at FROM public.house_style;
