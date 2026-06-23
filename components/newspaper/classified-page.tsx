/**
 * ClassifiedPage — renders a `classifieds` template page: one uploaded
 * classified file filling the whole page area, no running head/footer. Used by
 * the editor preview, per-page proof, View File, and the press route. PDFs are
 * shown in an <iframe> (the file is usually a full classifieds-page PDF);
 * images render directly. Client-safe (builds the public URL from NEXT_PUBLIC).
 */
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import type { ClassifiedPageData } from '@/lib/newspaper/classified';

const CLASSIFIEDS_BUCKET = 'classifieds';
function fileUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${CLASSIFIEDS_BUCKET}/${path}`;
}

function isPdf(data: ClassifiedPageData): boolean {
  const name = (data.file_name ?? data.storage_path ?? '').toLowerCase();
  return name.endsWith('.pdf');
}

export function ClassifiedPage({
  data,
  editing = false,
}: {
  data: ClassifiedPageData;
  /** When true (editor/proof preview) show a placeholder if no file is set. */
  editing?: boolean;
}) {
  const src = data.storage_path ? fileUrl(data.storage_path) : null;

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
        isPdf(data) ? (
          <iframe
            src={`${src}#toolbar=0&navpanes=0&view=FitH`}
            title={data.file_name ?? 'Classified'}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={data.file_name ?? 'Classifieds'}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )
      ) : editing ? (
        <div
          className="border-2 border-dashed border-zinc-300 text-zinc-400 text-sm flex items-center justify-center text-center"
          style={{ width: '100%', height: '100%' }}
        >
          No classified placed — choose one from the Classified Upload library,
          <br />
          or drag a classified onto this page from the board.
        </div>
      ) : null}
    </div>
  );
}
