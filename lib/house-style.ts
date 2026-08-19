import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * House writing guidelines (migration 045) — the one document every AI
 * writing path consumes. The site reads it here; the office-PC desks fetch
 * it from /api/house-style. Both wrap it in the same PREAMBLE so precedence
 * is identical everywhere:
 *
 *   house guidelines  <  writer's own VOICE instructions (they win on
 *                        conflict)
 *   straight news     →  only the guidelines compatible with facts-only
 *                        reporting apply
 */

export const HOUSE_STYLE_KEY = 'writing_guidelines';

/** How the guidelines are introduced when they carry a voice (columns,
 *  analysis, the conservative national desk, the AI-revise box). */
export const HOUSE_STYLE_PREAMBLE_VOICE = `HOUSE WRITING GUIDELINES — apply these to everything you write for The South Shore Press. They describe HOW the prose should read; they never license adding facts, names, numbers, or quotes that are not in your material. Where any of them conflicts with the writer's own VOICE instructions above, the VOICE instructions win. Treat them as self-edit passes: draft, then read your draft against each one and fix what fails before you submit.`;

/** The straight-news variant (Gail Wynand's local desk): no opinion, no
 *  invented imperfection — only the guidelines that make facts-only copy
 *  read like a person wrote it. */
export const HOUSE_STYLE_PREAMBLE_STRAIGHT = `HOUSE WRITING GUIDELINES — apply these to your prose, WITHIN the rules of straight news above: no opinion, no commentary, no invented detail, every sentence a fact or an attributed statement. Use the guidelines that make factual copy read like a real reporter wrote it (natural rhythm, no formula, no stiff or over-polished phrasing, no AI slop); skip the ones that call for a point of view, hesitations, or deliberate imperfection — those belong to the opinion and column desks. Treat them as self-edit passes: draft, then read your draft against them and fix what fails before you submit.`;

export type HouseStyle = {
  content: string;
  updated_at: string | null;
};

/** Service-role read (no RLS), safe for server code and API routes. Returns
 *  null when the row/table is missing (migration 045 not applied). */
export async function getHouseStyle(): Promise<HouseStyle | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('house_style')
      .select('content, updated_at')
      .eq('key', HOUSE_STYLE_KEY)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('[getHouseStyle]', error);
      return null;
    }
    const content = String(data.content ?? '').trim();
    if (!content) return null;
    return { content, updated_at: (data.updated_at as string | null) ?? null };
  } catch (err) {
    console.error('[getHouseStyle]', err);
    return null;
  }
}

/** The block to append to a system prompt. Empty string when there are no
 *  guidelines yet, so callers can concatenate unconditionally. */
export function houseStyleBlock(style: HouseStyle | null, mode: 'voice' | 'straight' = 'voice'): string {
  if (!style?.content) return '';
  const preamble = mode === 'straight' ? HOUSE_STYLE_PREAMBLE_STRAIGHT : HOUSE_STYLE_PREAMBLE_VOICE;
  return `\n\n${preamble}\n\n${style.content.trim()}`;
}
