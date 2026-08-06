'use client';

/** One folder of a client's files, reverse-chron with dates. */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2 } from 'lucide-react';
import { adFilePublicUrl } from '@/lib/ad-files';
import { AD_SIZES } from '@/lib/newspaper-templates';
import type { AdClientFile, AdFileKind } from '@/lib/queries/ad-clients';
import { deleteAdClientFile } from '../../actions';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function sizeLabel(size: string | null): string | null {
  if (!size) return null;
  return AD_SIZES.find((s) => s.value === size)?.label ?? size;
}

export function FolderView({
  clientId,
  kind,
  files,
  isAdmin,
}: {
  clientId: string;
  kind: AdFileKind;
  files: AdClientFile[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(file: AdClientFile) {
    if (!confirm(`Delete "${file.file_name ?? 'this file'}"? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteAdClientFile(file.id, clientId);
      if (!res.ok) alert(res.error ?? 'Could not delete.');
      else router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded border border-zinc-200">
      <div
        className={`grid ${isAdmin ? 'grid-cols-[8rem_1fr_8rem_3rem]' : 'grid-cols-[8rem_1fr_8rem]'} items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500`}
      >
        <div>Date</div>
        <div>File</div>
        <div>{kind === 'copy' ? 'Size' : ''}</div>
        {isAdmin ? <div className="text-right">Del</div> : null}
      </div>
      {files.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-400">
          Nothing here yet — use the &ldquo;+ New&rdquo; button on the client page.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {files.map((f) => (
            <li
              key={f.id}
              className={`grid ${isAdmin ? 'grid-cols-[8rem_1fr_8rem_3rem]' : 'grid-cols-[8rem_1fr_8rem]'} items-center gap-3 px-4 py-3`}
            >
              <div className="text-sm text-zinc-500">{fmtDate(f.created_at)}</div>
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <a
                  href={adFilePublicUrl(f.storage_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-red hover:underline truncate"
                >
                  {f.file_name || 'View file'}
                </a>
              </div>
              <div className="text-xs text-zinc-500">{sizeLabel(f.copy_size) ?? ''}</div>
              {isAdmin ? (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(f)}
                    disabled={isPending}
                    className="inline-flex items-center justify-center w-8 h-8 rounded border border-zinc-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
