import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { LEGALS_BUCKET } from '@/lib/queries/legals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/legals — the press-export workflow publishes each issue's
 * legal-notices section here (extracted + compressed by
 * scripts/publish-digital-paper.mjs), so the public Legals library fills in
 * automatically alongside the Digital Paper archive. Guarded by the print
 * token like /api/ingest/digital-paper.
 *
 *   {action:'sign'}   → signed Storage upload URL in the public legals bucket
 *   {action:'record', legal_date, storage_path, file_name}
 *                     → files the row; any existing rows for that date are
 *                       replaced (re-exports update, never duplicate)
 */

function authorized(req: Request): boolean {
  const token = req.headers.get('x-ssp-print-token') ?? req.headers.get('x-ssp-ingest-token');
  const expected = [process.env.PRINT_API_TOKEN, process.env.INDESIGN_API_TOKEN].filter(Boolean);
  return Boolean(token && expected.includes(token));
}

export async function POST(req: Request) {
  if (![process.env.PRINT_API_TOKEN, process.env.INDESIGN_API_TOKEN].some(Boolean)) {
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    legal_date?: string;
    storage_path?: string;
    file_name?: string;
  };
  const admin = createAdminClient();

  if (body.action === 'sign') {
    const path = `${randomUUID()}.pdf`;
    const { data, error } = await admin.storage.from(LEGALS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[ingest/legals] sign', error);
      return NextResponse.json({ error: 'Could not create the upload URL.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, path, token: data.token, signedUrl: data.signedUrl });
  }

  if (body.action === 'record') {
    const legalDate = (body.legal_date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(legalDate)) {
      return NextResponse.json({ error: 'legal_date must be YYYY-MM-DD.' }, { status: 400 });
    }
    if (!body.storage_path) {
      return NextResponse.json({ error: 'storage_path is required.' }, { status: 400 });
    }

    // Replace-in-place: an issue re-export supersedes that date's file(s).
    const { data: existing } = await admin
      .from('legals')
      .select('id, storage_path')
      .eq('legal_date', legalDate);
    for (const row of existing ?? []) {
      if (row.storage_path && row.storage_path !== body.storage_path) {
        const { error: rmErr } = await admin.storage
          .from(LEGALS_BUCKET)
          .remove([row.storage_path as string]);
        if (rmErr) console.error('[ingest/legals] old object remove', rmErr);
      }
      await admin.from('legals').delete().eq('id', row.id);
    }

    const { error } = await admin.from('legals').insert({
      legal_date: legalDate,
      storage_path: body.storage_path,
      file_name: (body.file_name ?? '').trim() || null,
      created_by: null,
    });
    if (error) {
      console.error('[ingest/legals] insert', error);
      return NextResponse.json({ error: 'Could not save the legal.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, legal_date: legalDate, replaced: (existing ?? []).length });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
