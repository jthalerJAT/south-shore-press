import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Shared helpers for the token-guarded print API the InDesign UXP plugin
 * calls. Permissive CORS so the plugin (which fetches cross-origin) can read
 * the responses; a static shared token (INDESIGN_API_TOKEN) gates access so
 * unpublished page data isn't world-readable.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-ssp-print-token, content-type',
  'Cache-Control': 'no-store',
};

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function printJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

/** Verify the shared token. Returns null when OK, or an error response. */
export function checkPrintToken(req: Request): NextResponse | null {
  const expected = process.env.INDESIGN_API_TOKEN;
  if (!expected) return printJson({ error: 'Print API is not configured (no INDESIGN_API_TOKEN).' }, 503);
  if (req.headers.get('x-ssp-print-token') !== expected) {
    return printJson({ error: 'Unauthorized.' }, 401);
  }
  return null;
}
