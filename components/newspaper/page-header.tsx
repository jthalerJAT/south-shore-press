/**
 * Running head shown on most interior pages (not full-page ads / covers). The
 * printed paper MIRRORS it by page parity:
 *   even (left) page:  Page X  ~  The South Shore Press • <date>        Visit us on the web …
 *   odd  (right) page: Visit us on the web …        The South Shore Press • <date>  ~  Page X
 * followed by a divider. Presentational; rendered at the page content width.
 */
import { Seagull } from './seagull';

const VISIT = 'Visit us on the web at www.southshorepress.com';

function Masthead({ pageNumber, dateLabel }: { pageNumber: number; dateLabel?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontWeight: 700 }}>Page {pageNumber}</span>
      <Seagull width={16} />
      <span style={{ fontFamily: 'var(--font-crimson)', fontWeight: 700 }}>The South Shore Press</span>
      {dateLabel ? <span className="text-zinc-600">• {dateLabel}</span> : null}
    </div>
  );
}

function MastheadReversed({ pageNumber, dateLabel }: { pageNumber: number; dateLabel?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: 'var(--font-crimson)', fontWeight: 700 }}>The South Shore Press</span>
      {dateLabel ? <span className="text-zinc-600">• {dateLabel}</span> : null}
      <Seagull width={16} />
      <span style={{ fontWeight: 700 }}>Page {pageNumber}</span>
    </div>
  );
}

export function PageHeader({ pageNumber, dateLabel }: { pageNumber: number; dateLabel?: string }) {
  const odd = pageNumber % 2 === 1;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
        {odd ? (
          <>
            <span className="text-zinc-600">{VISIT}</span>
            <MastheadReversed pageNumber={pageNumber} dateLabel={dateLabel} />
          </>
        ) : (
          <>
            <Masthead pageNumber={pageNumber} dateLabel={dateLabel} />
            <span className="text-zinc-600">{VISIT}</span>
          </>
        )}
      </div>
      <div style={{ borderBottom: '1.5px solid #000', marginTop: 4 }} />
    </div>
  );
}
