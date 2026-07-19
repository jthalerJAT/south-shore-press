'use client';

/**
 * ImageLibraryPicker — modal for choosing a photo from the Owned Images
 * library (instead of uploading from the desktop). Search filters live to all
 * matches; clicking a thumbnail returns its public URL. Used by fields that
 * must draw on house photography — e.g. the Page 2 author headshot.
 */
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { searchOwnedImages } from '../owned-images/actions';

type LibImage = { id: string; url: string; fileName: string | null; createdAt: string };

export function ImageLibraryPicker({
  onPick,
  onClose,
  title = 'Choose from the photo library',
}: {
  onPick: (url: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<LibImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on open + re-search (debounced) as the user types.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await searchOwnedImages(query);
      if (!res.ok) {
        setError(res.error ?? 'Could not load the library.');
        return;
      }
      setError(null);
      setImages(res.images ?? []);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-library-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-4">
          <h2 id="image-library-title" className="font-headline text-xl font-bold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            ✕ Close
          </button>
        </div>

        <div className="px-6 py-3 border-b border-zinc-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search images by name…"
              className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto ssp-scroll px-6 py-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : images === null ? (
            <p className="text-sm text-zinc-500">Loading the library…</p>
          ) : images.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {query.trim() ? `No images match “${query.trim()}”.` : 'The library is empty.'}
            </p>
          ) : (
            <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((im) => (
                <li key={im.id}>
                  <button
                    type="button"
                    onClick={() => onPick(im.url)}
                    title={im.fileName ?? undefined}
                    className="w-full text-left group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.url}
                      alt=""
                      className="w-full h-24 object-cover rounded border border-zinc-200 bg-zinc-100 group-hover:ring-2 group-hover:ring-brand-red transition-shadow"
                    />
                    <div className="mt-1 text-[11px] text-zinc-600 truncate">
                      {im.fileName || 'Untitled image'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
