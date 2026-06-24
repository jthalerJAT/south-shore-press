import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCurrentUser, canManageCredentials } from '@/lib/auth';
import { ccAuthorizeUrl, isConstantContactConfigured } from '@/lib/constant-contact/client';
import { getSiteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/** Admin-only: start the one-time Constant Contact OAuth connect. Redirects to
 *  CC's consent screen; the callback stores the resulting tokens. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageCredentials(user)) {
    return new NextResponse('Forbidden — admins only.', { status: 403 });
  }
  if (!isConstantContactConfigured()) {
    return new NextResponse(
      'Constant Contact is not configured. Set CONSTANT_CONTACT_CLIENT_ID, CONSTANT_CONTACT_CLIENT_SECRET and CONSTANT_CONTACT_LIST_ID in Vercel, then retry.',
      { status: 503 }
    );
  }

  const state = randomUUID();
  const res = NextResponse.redirect(ccAuthorizeUrl(getSiteOrigin(), state));
  // CSRF: only a browser that started here (admin-gated) carries this cookie.
  res.cookies.set('cc_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
