import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Auth callback endpoint. Supabase email links (confirmation,
 * password recovery, magic link) redirect here with a `?code=...`
 * query param. We exchange the code for a session (which sets the
 * auth cookies), then bounce the browser to wherever `next` says.
 *
 * Usage:
 *   /auth/callback?code=xxx&next=/reset-password
 *   /auth/callback?code=xxx&next=/account
 *
 * If `next` is missing, defaults to `/`. We only honor same-origin
 * relative paths in `next` to avoid open-redirect issues.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';
  const safeNext = nextParam.startsWith('/') ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed', error);
    return NextResponse.redirect(`${origin}/signin?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
