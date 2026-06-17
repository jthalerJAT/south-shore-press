import { createAdminClient } from '@/lib/supabase/admin';
import { pageMode, coverConfig } from '@/lib/newspaper-templates';
import { normalizeCover } from '@/lib/newspaper/section-cover';
import { getPrintSpec } from '@/lib/newspaper/print-templates';
import { SITE } from '@/lib/site-config';
import { checkPrintToken, corsPreflight, printJson } from '@/lib/newspaper/print-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight();
}

/** GET /api/print/page/[pageId] — meta + content data + layout spec for the
 *  UXP plugin to build the page. Token-guarded. */
export async function GET(req: Request, { params }: { params: { pageId: string } }) {
  const denied = checkPrintToken(req);
  if (denied) return denied;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return printJson({ error: 'Server is not configured for the print API.' }, 503);
  }

  const { data: page, error } = await admin
    .from('np_pages')
    .select('*')
    .eq('id', params.pageId)
    .maybeSingle();
  if (error) {
    console.error('[print/page]', error);
    return printJson({ error: 'Lookup failed.' }, 500);
  }
  if (!page) return printJson({ error: 'Page not found.' }, 404);

  const { data: all } = await admin
    .from('np_pages')
    .select('id')
    .order('page_order', { ascending: true });
  const ordinal = (all ?? []).findIndex((p) => (p as { id: string }).id === page.id) + 1;

  if (pageMode(page.kind) !== 'template') {
    return printJson({
      meta: { kind: page.kind, ordinal, title: page.title, mode: 'flow' },
      data: null,
      spec: null,
      message: 'Flow pages are not yet supported by the InDesign export.',
    });
  }

  const cfg = coverConfig(page.kind);
  const cover = normalizeCover(page.template_data, page.kind);
  const data = {
    ...cover,
    tiles: cover.tiles.slice(0, cover.tile_count),
    logo_url: SITE.logoUrl,
  };

  // DB-stored override spec wins; else the built-in default. (Missing table /
  // no row falls back gracefully.)
  const { data: tpl } = await admin
    .from('np_print_templates')
    .select('spec')
    .eq('kind', page.kind)
    .maybeSingle();
  const spec = (tpl?.spec as unknown) ?? getPrintSpec(page.kind);

  return printJson({
    meta: {
      kind: page.kind,
      variant: cfg?.variant ?? 'news',
      mastheadWord: cfg?.mastheadWord ?? null,
      ordinal,
      title: page.title,
      mode: 'template',
    },
    data,
    spec,
  });
}
