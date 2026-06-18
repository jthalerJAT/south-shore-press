/**
 * Running head shown on most interior pages (not full-page ads):
 *   Page X  [seagull]  The South Shore Press • <date>      Visit us on the web at www.southshorepress.com
 * followed by a divider. Presentational; rendered at the page content width.
 */
import { Seagull } from './seagull';

export function PageHeader({ pageNumber, dateLabel }: { pageNumber: number; dateLabel?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 700 }}>Page {pageNumber}</span>
          <Seagull width={24} />
          <span className="font-headline" style={{ fontWeight: 700 }}>
            The South Shore Press
          </span>
          {dateLabel ? <span className="text-zinc-600">• {dateLabel}</span> : null}
        </div>
        <span className="text-zinc-600">Visit us on the web at www.southshorepress.com</span>
      </div>
      <div style={{ borderBottom: '1.5px solid #000', marginTop: 4 }} />
    </div>
  );
}
