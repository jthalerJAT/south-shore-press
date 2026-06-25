import { NextResponse } from 'next/server';
import { getCurrentUser, canManageCredentials } from '@/lib/auth';
import { ccListContactLists, isConstantContactConfigured } from '@/lib/constant-contact/client';

export const dynamic = 'force-dynamic';

/** Admin-only helper: list this account's Constant Contact lists with their IDs
 *  so you can copy the right one into CONSTANT_CONTACT_LIST_ID. Requires the
 *  OAuth connect to have been completed first. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageCredentials(user)) {
    return new NextResponse('Forbidden — admins only.', { status: 403 });
  }
  if (!isConstantContactConfigured()) {
    return NextResponse.json({ error: 'Constant Contact app credentials are not set.' }, { status: 503 });
  }
  try {
    const lists = await ccListContactLists();
    return NextResponse.json({ lists }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[constant-contact lists]', e);
    return NextResponse.json(
      { error: 'Could not fetch lists. Have you connected Constant Contact yet (Editor Portal → Connect)?' },
      { status: 502 }
    );
  }
}
