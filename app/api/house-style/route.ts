import { NextResponse } from 'next/server';
import {
  getHouseStyle,
  HOUSE_STYLE_PREAMBLE_VOICE,
  HOUSE_STYLE_PREAMBLE_STRAIGHT,
} from '@/lib/house-style';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/house-style — the house writing guidelines for the office-PC AI
 * desks (Howard Roark / Gail Wynand / Henry Cameron). Token-guarded with the
 * same shared secret as story ingest: `x-ssp-ingest-token` = STORY_INGEST_TOKEN.
 *
 * Returns the guidelines plus both preambles so every consumer frames them
 * identically (precedence: writer VOICE > house guidelines; straight news
 * applies only the facts-compatible subset).
 */
export async function GET(req: Request) {
  const expected = process.env.STORY_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-ssp-ingest-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const style = await getHouseStyle();
  return NextResponse.json({
    ok: true,
    content: style?.content ?? '',
    updated_at: style?.updated_at ?? null,
    preamble_voice: HOUSE_STYLE_PREAMBLE_VOICE,
    preamble_straight: HOUSE_STYLE_PREAMBLE_STRAIGHT,
  });
}
