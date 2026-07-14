'use client';

/**
 * LegalPage — to-scale renderer for a `legals` template page, matching p18 of
 * the printed 2026-06-17 issue:
 *   - the standard running PageHeader,
 *   - a navy "LEGAL NOTICES • LEGAL NOTICES • LEGAL NOTICES" banner,
 *   - a black "Public Notices" tab leading dense multi-column justified copy,
 *     each notice separated by a centered underlined PUBLIC NOTICE header,
 *   - the "EMAIL LEGAL NOTICES TO LEGALS@SOUTHSHOREPRESS.COM" footer bar.
 * Shared by the editor preview, per-page proof, View File, and the press
 * route — so screen == print. Text overflowing the fixed page height spills
 * into clipped extra columns; the editor warns when that happens.
 */
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { PageHeader } from './page-header';
import { LEGAL_PAGE_COLUMNS, DEFAULT_LEGAL_HEADER, type LegalPageData } from '@/lib/newspaper/legal-page';

const NAVY = '#1e3a8a';
const CONDENSED_FONT = "var(--font-news-condensed), 'Arial Narrow', sans-serif";

export function LegalPage({
  data,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: LegalPageData;
  pageNumber: number;
  dateLabel?: string;
  editing?: boolean;
}) {
  const columns = data.columns ?? LEGAL_PAGE_COLUMNS;
  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, background: '#fff', color: '#111' }}
    >
      <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />

      {/* ── Banner ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          background: NAVY,
          color: '#fff',
          height: 44,
          border: '2px solid #000',
          fontFamily: CONDENSED_FONT,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: '0.08em',
        }}
      >
        LEGAL NOTICES&ensp;•&ensp;LEGAL NOTICES&ensp;•&ensp;LEGAL NOTICES
      </div>

      {/* ── Notice columns ─────────────────────────────────── */}
      <div className="flex-1" style={{ minHeight: 0, padding: '8px 0', overflow: 'hidden' }}>
        {data.notices.length === 0 ? (
          editing ? (
            <div className="h-full border-2 border-dashed border-zinc-300 text-zinc-400 text-sm flex items-center justify-center">
              No notices placed — click “+ Add New Legal”.
            </div>
          ) : null
        ) : (
          <div
            data-legal-columns
            style={{
              height: '100%',
              columnCount: columns,
              // Newspaper flow: fill column 1 to the full page height, then
              // column 2, ... — NOT the default 'balance', which spreads short
              // copy into an even horizontal band across every column.
              columnFill: 'auto',
              columnGap: 10,
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: 9.5,
              lineHeight: 1.28,
              textAlign: 'justify',
              wordBreak: 'break-word',
            }}
          >
            {/* Black Public Notices tab leads the first column. */}
            <div
              style={{
                breakInside: 'avoid',
                background: '#000',
                color: '#fff',
                fontFamily: CONDENSED_FONT,
                fontWeight: 700,
                fontSize: 13,
                textAlign: 'center',
                padding: '3px 0',
                marginBottom: 6,
              }}
            >
              Public Notices
            </div>
            {data.notices.map((n, i) => (
              <div key={n.id}>
                {/* Horizontal rule between notices, as in the printed page. */}
                {i > 0 ? <div style={{ borderTop: '1px solid #000', margin: '8px 0 0' }} /> : null}
                <div
                  style={{
                    breakInside: 'avoid',
                    textAlign: 'center',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    fontSize: 10,
                    margin: `${i === 0 ? 0 : 6}px 0 4px`,
                  }}
                >
                  {n.header?.trim() || DEFAULT_LEGAL_HEADER}
                </div>
                <div style={{ whiteSpace: 'pre-line' }}>{n.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          borderTop: `3px solid ${NAVY}`,
          borderBottom: `3px solid ${NAVY}`,
          height: 40,
          fontFamily: CONDENSED_FONT,
          fontSize: 22,
          letterSpacing: '0.02em',
          color: '#000',
        }}
      >
        <span style={{ fontWeight: 600 }}>EMAIL LEGAL NOTICES TO&nbsp;</span>
        <span style={{ fontWeight: 800 }}>LEGALS@SOUTHSHOREPRESS.COM</span>
      </div>
    </div>
  );
}
