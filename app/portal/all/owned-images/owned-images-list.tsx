'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { deleteOwnedImage, renameOwnedImage } from './actions';
import { uploadImage } from '../newspaper-creator/image-upload-client';

type Img = { id: string; url: string; fileName: string | null; createdAt: string };

export function OwnedImagesList({ images }: { images: Img[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Inline rename state: which row is being renamed + the draft name.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  // Direct-to-library upload (same pipeline the photo fields use — signed
  // upload to the newspaper-images bucket + automatic library indexing).
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      const res = await uploadImage(file);
      if (!res.ok) failed.push(`${file.name}: ${res.error ?? 'upload failed'}`);
    }
    setUploading(false);
    if (failed.length > 0) setError(failed.join(' · '));
    router.refresh();
  }

  // Live filter — every keystroke narrows the list to all matches.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return images;
    return images.filter((im) =>
      `${im.fileName ?? ''} ${im.url}`.toLowerCase().includes(needle)
    );
  }, [images, query]);

  function copy(url: string, id: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    });
  }

  function remove(id: string) {
    if (!confirm('Delete this image? Stories already using its URL will lose the picture.')) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteOwnedImage(id);
      if (!res.ok) setError(res.error ?? 'Could not delete.');
      else router.refresh();
    });
  }

  function startRename(im: Img) {
    setRenaming(im.id);
    setDraftName(im.fileName ?? '');
    setError(null);
  }

  function saveRename(id: string) {
    const name = draftName.trim();
    if (!name) {
      setError('Name cannot be empty.');
      return;
    }
    startTransition(async () => {
      const res = await renameOwnedImage(id, name);
      if (!res.ok) {
        setError(res.error ?? 'Could not rename.');
        return;
      }
      setRenaming(null);
      router.refresh();
    });
  }

  return (
    <>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {/* Search + upload — the search filters live; the button uploads from
          the PC straight into the library. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images by name…"
            className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleUpload(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
        >
          {uploading ? 'Uploading…' : '+ Upload New Image'}
        </button>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No uploaded images yet. Use “+ Upload New Image” above, or any “+ Upload Photo” button on
          a story or cover field — everything lands here.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-zinc-500">No images match “{query.trim()}”.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded bg-white">
          {visible.map((im) => (
            <li key={im.id} className="flex items-center gap-4 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="w-16 h-16 object-cover rounded bg-zinc-100 border border-zinc-200 shrink-0" />
              <div className="min-w-0 flex-1">
                {renaming === im.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(im.id);
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      className="block w-full max-w-sm rounded border border-zinc-300 px-2 py-1 text-sm focus:border-brand-red focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveRename(im.id)}
                      disabled={pending}
                      className="text-xs font-medium text-brand-red hover:underline disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming(null)}
                      className="text-xs font-medium text-zinc-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-zinc-900 truncate">{im.fileName || 'Untitled image'}</div>
                )}
                <div className="text-xs text-zinc-500">{new Date(im.createdAt).toLocaleString('en-US')}</div>
                <div className="mt-0.5 text-[11px] text-zinc-400 truncate">{im.url}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button type="button" onClick={() => startRename(im)} className="text-xs font-medium text-zinc-600 hover:underline">
                  Rename
                </button>
                <button type="button" onClick={() => copy(im.url, im.id)} className="text-xs font-medium text-brand-red hover:underline">
                  {copied === im.id ? 'Copied!' : 'Copy URL'}
                </button>
                <a href={im.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-600 hover:underline">
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => remove(im.id)}
                  disabled={pending}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
