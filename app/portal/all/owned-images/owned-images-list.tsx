'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteOwnedImage } from './actions';

type Img = { id: string; url: string; fileName: string | null; createdAt: string };

export function OwnedImagesList({ images }: { images: Img[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (images.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No uploaded images yet. Use a “+ Upload Photo” button on any story or cover field and the
        image will appear here.
      </p>
    );
  }

  return (
    <>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded bg-white">
        {images.map((im) => (
          <li key={im.id} className="flex items-center gap-4 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt="" className="w-16 h-16 object-cover rounded bg-zinc-100 border border-zinc-200 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-900 truncate">{im.fileName || 'Untitled image'}</div>
              <div className="text-xs text-zinc-500">{new Date(im.createdAt).toLocaleString('en-US')}</div>
              <div className="mt-0.5 text-[11px] text-zinc-400 truncate">{im.url}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
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
    </>
  );
}
