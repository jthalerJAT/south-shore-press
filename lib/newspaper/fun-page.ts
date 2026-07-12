/**
 * "Fun Stuff" pages — Box Office, Puzzles, Funny Pages, This Week in History.
 * Each is produced by its own standalone Vercel app (kept as-is). The editor's
 * "Pull from app" button loads that app with `?ssp_embed=1`, the app runs its
 * normal generation and posts its finished `#newspaperPage` HTML + `<style>` CSS
 * back; we store that self-contained snapshot in np_pages.template_data and
 * render it at 11×15 under our header (see components/newspaper/fun-page.tsx).
 *
 * Client-safe (no server imports) — imported by both the editor and renderer.
 */

export type FunSourceKey = 'box_office' | 'puzzles' | 'comics' | 'history';

export type FunSource = {
  key: FunSourceKey;
  /** Header + button label ("Box Office" → "Pull from Box Office"). */
  label: string;
  /** The standalone app's deploy origin. Overridable per-app via env. */
  appUrl: string;
};

function clean(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * kind → source app. Deploy URLs default to the ssp-*.vercel.app convention and
 * are overridable via NEXT_PUBLIC_* env vars (static access so Next inlines them
 * into the client bundle). Confirm the real URLs before relying in production.
 */
export const FUN_SOURCES: Record<string, FunSource> = {
  fun_box_office: {
    key: 'box_office',
    label: 'Box Office',
    appUrl: clean(process.env.NEXT_PUBLIC_SSP_BOX_OFFICE_URL || 'https://ssp-box-office.vercel.app'),
  },
  fun_puzzles: {
    key: 'puzzles',
    label: 'Puzzles',
    appUrl: clean(process.env.NEXT_PUBLIC_SSP_PUZZLES_URL || 'https://ssp-puzzles.vercel.app'),
  },
  fun_comics: {
    key: 'comics',
    label: 'Funny Pages',
    appUrl: clean(process.env.NEXT_PUBLIC_SSP_FUNNY_PAGES_URL || 'https://ssp-funny-pages.vercel.app'),
  },
  fun_history: {
    key: 'history',
    label: 'This Week in History',
    appUrl: clean(process.env.NEXT_PUBLIC_SSP_HISTORY_URL || 'https://ssp-history.vercel.app'),
  },
};

export function getFunSource(kind: string): FunSource | null {
  return FUN_SOURCES[kind] ?? null;
}

/** The printed section header shown on every Fun Stuff page (all four pull
 *  pages share one masthead in the paper, regardless of which app fed them). */
export const FUN_SECTION_HEADER = 'Fun Stuff';

/** The self-contained page snapshot pulled from a Fun Stuff app. */
export type FunPageData = {
  v: 1;
  /** `#newspaperPage` outerHTML from the source app (images inline as data URIs). */
  html?: string;
  /** The source app's combined `<style>` CSS. */
  css?: string;
  /** ISO timestamp of the last successful pull. */
  pulled_at?: string;
  /** Which app it came from, for display ("Box Office"). */
  source_label?: string;
  /** Ad placed in the bottom third of the page (an Ad Database creative in the
   *  newspaper-ads bucket). The pulled content fills the top two-thirds. */
  ad_storage_path?: string;
  ad_file_name?: string;
};

export function normalizeFunPage(raw: unknown): FunPageData {
  if (!raw || typeof raw !== 'object') return { v: 1 };
  const r = raw as Partial<FunPageData>;
  return {
    v: 1,
    html: typeof r.html === 'string' ? r.html : undefined,
    css: typeof r.css === 'string' ? r.css : undefined,
    pulled_at: typeof r.pulled_at === 'string' ? r.pulled_at : undefined,
    source_label: typeof r.source_label === 'string' ? r.source_label : undefined,
    ad_storage_path: typeof r.ad_storage_path === 'string' ? r.ad_storage_path : undefined,
    ad_file_name: typeof r.ad_file_name === 'string' ? r.ad_file_name : undefined,
  };
}

export function funPageHasContent(data: FunPageData): boolean {
  return Boolean(data.html && data.html.length > 0);
}

/** The message a Fun Stuff app posts back when loaded with `?ssp_embed=1`. */
export type FunPullMessage = {
  type: 'ssp_page';
  app?: string;
  html: string;
  css: string;
};

export function isFunPullMessage(v: unknown): v is FunPullMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return m.type === 'ssp_page' && typeof m.html === 'string' && typeof m.css === 'string';
}
