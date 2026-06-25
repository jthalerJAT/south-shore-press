import { NextResponse } from 'next/server';
import { getCurrentUser, canManageCredentials } from '@/lib/auth';
import { isSimpleCircConfigured, addPaidSubscriber } from '@/lib/simplecirc/client';

export const dynamic = 'force-dynamic';

/**
 * Admin-only diagnostic: pushes ONE clearly-labeled test subscriber to
 * SimpleCirc through the exact code the Stripe webhook uses, so you can verify
 * the API token + publication/postage IDs work without a real Stripe charge.
 *
 * Each call creates a real (deletable) "API TEST" subscriber — delete it in
 * SimpleCirc after confirming. Returns which env vars are present (no values)
 * plus the create result / error code.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageCredentials(user)) {
    return new NextResponse('Forbidden — admins only.', { status: 403 });
  }

  const env = {
    SIMPLECIRC_API_TOKEN: Boolean(process.env.SIMPLECIRC_API_TOKEN),
    SIMPLECIRC_PUBLICATION_ID: Boolean(process.env.SIMPLECIRC_PUBLICATION_ID),
    SIMPLECIRC_POSTAGE_ID: Boolean(process.env.SIMPLECIRC_POSTAGE_ID),
  };

  if (!isSimpleCircConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'not_configured', env, note: 'Set the missing SIMPLECIRC_* env vars in Vercel + redeploy.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const result = await addPaidSubscriber({
    firstName: 'API',
    lastName: 'TEST — DELETE ME',
    address1: '1 Test Street',
    city: 'Patchogue',
    state: 'NY',
    zip: '11772',
    email: 'ssp-api-test@example.com',
    phone: '(631) 555-0100',
    issues: 1,
    amountPaid: 0,
  });

  return NextResponse.json(
    {
      env,
      result,
      note: result.ok
        ? 'Success — find "API TEST — DELETE ME" in SimpleCirc → Subscribers and delete it.'
        : 'Failed — check the error code + the Vercel function logs for the SimpleCirc response body.',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
