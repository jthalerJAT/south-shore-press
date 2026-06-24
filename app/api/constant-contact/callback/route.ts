import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ccExchangeCode } from '@/lib/constant-contact/client';
import { getSiteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/** OAuth redirect target. Verifies the CSRF state cookie set by /connect, then
 *  exchanges the code for tokens and stores them. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = cookies().get('cc_oauth_state')?.value;
  const portal = `${getSiteOrigin()}/portal/all`;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${portal}?cc=error`);
  }

  try {
    await ccExchangeCode(code, getSiteOrigin());
  } catch (e) {
    console.error('[constant-contact callback]', e);
    return NextResponse.redirect(`${portal}?cc=error`);
  }

  const res = NextResponse.redirect(`${portal}?cc=connected`);
  res.cookies.delete('cc_oauth_state');
  return res;
}
