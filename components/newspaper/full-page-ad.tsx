/**
 * FullPageAd — renders a `full_page_ad` template page: the standard running
 * PageHeader (present on full-page ads in the printed paper — see p17 of the
 * 2026-07-15 issue) with one ad creative filling the rest of the page. Used by
 * the editor preview, the per-page print proof, View File, and the press print
 * route, so screen == print. Pure/presentational; client-safe (builds the
 * public URL from the NEXT_PUBLIC env, no server import).
 */
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import type { FullAdData } from '@/lib/newspaper/full-ad';
import { AdCopyView } from './ad-copy';
import { PageHeader } from './page-header';

const ADS_BUCKET = 'newspaper-ads';
function adUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${ADS_BUCKET}/${path}`;
}

export function FullPageAd({
  data,
  pageNumber,
  dateLabel,
  editing = false,
}: {
  data: FullAdData;
  /** Running-head page number; omitted → no header (legacy call sites). */
  pageNumber?: number;
  /** Issue date from the Front Page, shown in the running head. */
  dateLabel?: string;
  /** When true (editor/proof preview) show a placeholder if no ad is set. */
  editing?: boolean;
}) {
  const src = data.storage_path ? adUrl(data.storage_path) : null;

  return (
    <div
      className="flex flex-col"
      style={{ width: CONTENT_W_PX, height: CONTENT_H_PX, background: '#fff', overflow: 'hidden' }}
    >
      {typeof pageNumber === 'number' && pageNumber > 0 ? (
        <PageHeader pageNumber={pageNumber} dateLabel={dateLabel} />
      ) : null}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {src ? (
          <AdCopyView
            src={src}
            fileName={data.file_name ?? data.business_name}
            storagePath={data.storage_path}
            style={{ width: '100%', height: '100%', objectFit: 'fill' }}
          />
        ) : editing ? (
          <div
            className="border-2 border-dashed border-zinc-300 text-zinc-400 text-sm flex items-center justify-center"
            style={{ width: '100%', height: '100%' }}
          >
            No ad placed — drop or upload an ad
          </div>
        ) : null}
      </div>
    </div>
  );
}
