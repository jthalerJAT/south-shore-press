'use client';

/**
 * PhotoUrlField — a photo input that keeps the URL text field (paste a
 * Cloudinary / external URL) AND adds a "+ Upload Photo" button beside it for
 * proprietary images. Uploaded files go to the newspaper-images bucket and are
 * indexed in the Owned Images library; the field is set to the resulting URL
 * and a thumbnail is shown.
 */
import { useRef, useState } from 'react';
import { uploadImage } from './image-upload-client';

export function PhotoUrlField({
  label,
  value,
  onChange,
  addLabel = '+ Upload Photo',
  hint,
}: {
  /** Omit for compact rows (e.g. an additional-photos list). */
  label?: string;
  value?: string;
  onChange: (url: string) => void;
  addLabel?: string;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (!res.ok) {
      setError(res.error ?? 'Upload failed.');
      return;
    }
    onChange(res.url!);
  }

  return (
    <div>
      {label ? <label className="block text-sm font-medium text-zinc-700">{label}</label> : null}
      <div className={`flex items-center gap-2 ${label ? 'mt-1' : ''}`}>
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a photo URL, or upload →"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 inline-flex items-center px-3 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
        >
          {uploading ? 'Uploading…' : addLabel}
        </button>
      </div>
      {value ? (
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-16 h-16 object-cover bg-zinc-100 rounded border border-zinc-200" />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-600 hover:underline">
            remove
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}
