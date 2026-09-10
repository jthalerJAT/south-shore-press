import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { DIGITAL_PAPERS_BUCKET } from '@/lib/queries/digital-papers';
import { upsertDigitalPaper } from '@/lib/digital-papers-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/digital-paper — the press-export workflow publishes the
 * compressed web PDF of each issue here. Token-guarded with the print/export
 * token the workflow already holds (PRINT_API_TOKEN, INDESIGN_API_TOKEN
 * legacy fallback — the same pair the /print/issue pages accept).
 *
 * Two-step because Vercel bodies cap at ~4.5MB and the PDFs are ~15MB:
 *   {action:'sign'}    → {path, token, signedUrl}: runner PUTs the PDF
 *                        straight to Supabase Storage
 *   {action:'record', issue_date, storage_path, file_name, page_count,
 *    file_size_bytes}  → upserts the digital_papers row (replaces the
 *                        file if that issue date already exists)
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
    issue_date?: string;
    storage_path?: string;
    file_name?: string;
    page_count?: number;
    file_size_bytes?: number;
  };

  if (body.action === 'sign') {
    const admin = createAdminClient();
    const path = `${randomUUID()}.pdf`;
    const { data, error } = await admin.storage
      .from(DIGITAL_PAPERS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[ingest/digital-paper] sign', error);
      return NextResponse.json(
        { error: 'Could not create the upload URL — is migration 047 applied?' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, path, token: data.token, signedUrl: data.signedUrl });
  }

  if (body.action === 'record') {
    const issueDate = (body.issue_date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      return NextResponse.json({ error: 'issue_date must be YYYY-MM-DD.' }, { status: 400 });
    }
    if (!body.storage_path) {
      return NextResponse.json({ error: 'storage_path is required.' }, { status: 400 });
    }
    const res = await upsertDigitalPaper({
      issue_date: issueDate,
      storage_path: body.storage_path,
      file_name: (body.file_name ?? '').trim() || null,
      page_count: Number.isFinite(body.page_count) ? Number(body.page_count) : null,
      file_size_bytes: Number.isFinite(body.file_size_bytes) ? Number(body.file_size_bytes) : null,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, issue_date: issueDate });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
