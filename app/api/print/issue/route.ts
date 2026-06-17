import { createAdminClient } from '@/lib/supabase/admin';
import { pageMode } from '@/lib/newspaper-templates';
import { checkPrintToken, corsPreflight, printJson } from '@/lib/newspaper/print-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight();
}

/** GET /api/print/issue — the issue's pages (for the plugin's page picker and,
 *  later, the whole-issue build loop). Token-guarded. */
export async function GET(req: Request) {
  const denied = checkPrintToken(req);
  if (denied) return denied;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return printJson({ error: 'Server is not configured for the print API.' }, 503);
  }

  const { data, error } = await admin
    .from('np_pages')
    .select('id, page_order, kind, title, include_in_paper')
    .order('page_order', { ascending: true });
  if (error) {
    console.error('[print/issue]', error);
    return printJson({ error: 'Could not load pages.' }, 500);
  }

  const pages = (data ?? []).map((p, i) => {
    const row = p as { id: string; kind: string; title: string; include_in_paper: boolean | null };
    return {
      id: row.id,
      ordinal: i + 1,
      kind: row.kind,
      title: row.kind === 'generic' ? `Page ${i + 1}` : row.title,
      mode: pageMode(row.kind),
      include_in_paper: row.include_in_paper !== false,
    };
  });
  return printJson({ pages });
}
