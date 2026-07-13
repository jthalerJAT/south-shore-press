/**
 * Legal Notices page template data — stored in np_pages.template_data for a
 * `legals` kind page. The page is the printed legals layout (2026-06-17 issue,
 * p18): navy "LEGAL NOTICES" banner, dense multi-column justified notice copy
 * with centered PUBLIC NOTICE separators, and the EMAIL LEGAL NOTICES footer.
 * Client-safe (no server imports).
 */

export const LEGAL_PAGE_COLUMNS = 6;

export type PlacedLegalNotice = {
  id: string;
  /** legal_notices row this came from (reference; body below is the snapshot). */
  notice_id?: string | null;
  body: string;
};

export type LegalPageData = {
  v: 1;
  notices: PlacedLegalNotice[];
  /** Column count (default 6, matching the printed page). */
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
            body: p.body,
          },
        ];
      })
    : [];
  const columns =
    typeof r.columns === 'number' && r.columns >= 3 && r.columns <= 8
      ? Math.round(r.columns)
      : LEGAL_PAGE_COLUMNS;
  return { v: 1, notices, columns };
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
