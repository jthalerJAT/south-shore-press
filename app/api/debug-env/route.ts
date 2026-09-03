import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY diagnostic (2026-09-03): reports which TURNSTILE-related env var
 * NAMES exist in the runtime environment — names and lengths only, never
 * values. Token-guarded with the ingest secret. DELETE after the Turnstile
 * rollout is verified.
 */
export async function GET(req: Request) {
  const expected = process.env.STORY_INGEST_TOKEN;
  if (!expected || req.headers.get('x-ssp-ingest-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const keys = Object.keys(process.env)
    .filter((k) => k.toUpperCase().includes('TURN'))
    .map((k) => ({
      name: JSON.stringify(k), // JSON-escaped so hidden characters show
      valueLength: (process.env[k] ?? '').length,
      valuePrefix: (process.env[k] ?? '').slice(0, 2),
    }));
  return NextResponse.json({ ok: true, turnstileKeys: keys, totalEnvKeys: Object.keys(process.env).length });
}
