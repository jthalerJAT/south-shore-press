/**
 * FullPageAd — renders a `full_page_ad` template page: one ad creative filling
 * the whole page area, no running head or footer. Used by the editor preview,
 * the per-page print proof, View File, and the press print route, so screen ==
 * print. Pure/presentational; client-safe (builds the public URL from the
 * NEXT_PUBLIC env, no server import).
 */
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import type { FullAdData } from '@/lib/newspaper/full-ad';

const ADS_BUCKET = 'newspaper-ads';
function adUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${ADS_BUCKET}/${path}`;
}

export function FullPageAd({
  data,
  editing = false,
}: {
  data: FullAdData;
  /** When true (editor/proof preview) show a placeholder if no ad is set. */
  editing?: boolean;
}) {
  const src = data.storage_path ? adUrl(data.storage_path) : null;

  return (
    <div
      style={{
        width: CONTENT_W_PX,
        height: CONTENT_H_PX,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={data.file_name ?? data.business_name ?? 'Advertisement'}
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
  );
}
