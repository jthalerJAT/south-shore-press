import { createClient } from '@/lib/supabase/server';

/** Story Draft Engine queries (migration 041). Editor-tier RLS. */

export type CandidateSource = {
  outlet: string | null;
  title: string | null;
  url: string | null;
};

export type StoryCandidate = {
  id: string;
  headline: string;
  summary: string | null;
  section: string | null;
  suggested_byline: string | null;
  sources: CandidateSource[];
  status: 'pending' | 'generated' | 'drafted' | 'deleted';
  article_headline: string | null;
  article_subline: string | null;
  article_body: string | null;
  byline: string | null;
  drafted_story_id: string | null;
  created_at: string;
};

export type CandidateFact = {
  id: string;
  candidate_id: string;
  fact: string;
  source_label: string | null;
  fact_order: number;
  added_by: string | null;
};

export type Writer = {
  id: string;
  name: string;
  desk: string | null;
  persona: string | null;
};

const CANDIDATE_COLS =
  'id, headline, summary, section, suggested_byline, sources, status, article_headline, article_subline, article_body, byline, drafted_story_id, created_at';

/** Active candidates (pending + generated), newest first. */
export async function getStoryCandidates(): Promise<StoryCandidate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('story_candidates')
    .select(CANDIDATE_COLS)
    .in('status', ['pending', 'generated'])
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[getStoryCandidates]', error);
    return [];
  }
  return (data ?? []) as StoryCandidate[];
}

/** One candidate + its fact menu (machine-extracted and editor-added). */
export async function getStoryCandidate(
  id: string
): Promise<{ candidate: StoryCandidate; facts: CandidateFact[] } | null> {
  const supabase = createClient();
  const { data: candidate, error } = await supabase
    .from('story_candidates')
    .select(CANDIDATE_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error || !candidate) {
    if (error) console.error('[getStoryCandidate]', error);
    return null;
  }
  const { data: facts, error: fErr } = await supabase
    .from('candidate_facts')
    .select('id, candidate_id, fact, source_label, fact_order, added_by')
    .eq('candidate_id', id)
    .order('fact_order');
  if (fErr) console.error('[getStoryCandidate] facts', fErr);
  return {
    candidate: candidate as StoryCandidate,
    facts: (facts ?? []) as CandidateFact[],
  };
}

/** Writer/persona profiles for the byline picker. */
export async function getWriters(): Promise<Writer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('writers')
    .select('id, name, desk, persona')
    .order('name');
  if (error) {
    console.error('[getWriters]', error);
    return [];
  }
  return (data ?? []) as Writer[];
}
