/**
 * Legal Notices page template data — stored in np_pages.template_data for a
 * `legals` kind page. The page is the printed legals layout (2026-06-17 issue,
 * p18): navy "LEGAL NOTICES" banner, dense multi-column justified notice copy
 * with centered PUBLIC NOTICE separators, and the EMAIL LEGAL NOTICES footer.
 * Client-safe (no server imports).
 */

// 5 per publisher direction 2026-07-17 (was 6, matching the 2026-06-17 issue).
export const LEGAL_PAGE_COLUMNS = 5;

/** The header printed above a notice when none is typed. */
export const DEFAULT_LEGAL_HEADER = 'PUBLIC NOTICE';

export type PlacedLegalNotice = {
  id: string;
  /** legal_notices row this came from (reference; body below is the snapshot). */
  notice_id?: string | null;
  /** Centered underlined title above the notice (default PUBLIC NOTICE;
   *  e.g. "Attorney" for attorney ads). */
  header?: string;
  body: string;
  /** The notice must keep running but the underlying action is no longer
   *  valid — prints with a bold diagonal CANCELLED stamp across the copy. */
  cancelled?: boolean;
};

export type LegalPageData = {
  v: 1;
  notices: PlacedLegalNotice[];
  /** Column count. No editor control sets this — normalize always resolves it
   *  to LEGAL_PAGE_COLUMNS so the constant governs every page, including ones
   *  saved when the default was 6. */
  columns?: number;
};

export function defaultLegalPage(): LegalPageData {
  return { v: 1, notices: [], columns: LEGAL_PAGE_COLUMNS };
}

export function normalizeLegalPage(raw: unknown): LegalPageData {
  if (!raw || typeof raw !== 'object') return defaultLegalPage();
  const r = raw as Partial<LegalPageData>;
  const notices: PlacedLegalNotice[] = Array.isArray(r.notices)
    ? (r.notices as unknown[]).flatMap((n, i): PlacedLegalNotice[] => {
        if (!n || typeof n !== 'object') return [];
        const p = n as Record<string, unknown>;
        if (typeof p.body !== 'string' || !p.body.trim()) return [];
        return [
          {
            id: typeof p.id === 'string' && p.id ? p.id : `n-${i}`,
            notice_id: typeof p.notice_id === 'string' ? p.notice_id : null,
            header: typeof p.header === 'string' && p.header.trim() ? p.header : undefined,
            body: p.body,
            cancelled: p.cancelled === true ? true : undefined,
          },
        ];
      })
    : [];
  // Ignore any stored value: previous saves baked in the old default (6),
  // and there is no editor control that sets columns intentionally.
  return { v: 1, notices, columns: LEGAL_PAGE_COLUMNS };
}

/** Picker/list label for a notice: its first non-empty line, truncated. */
export function legalNoticeLabel(body: string): string {
  const first = body
    .split(/\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  const label = (first ?? 'PUBLIC NOTICE').toUpperCase();
  return label.length > 60 ? `${label.slice(0, 57)}…` : label;
}
