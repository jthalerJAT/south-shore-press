'use client';

/** Customer "new ad" form: copy upload (drag/drop), page size, notes ≤500 words. */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AD_FILES_BUCKET } from '@/lib/ad-files';
import { requestCustomerAdUploadUrl, saveCustomerAd } from '../actions';

const SIZES = [
  { value: 'full', label: 'Full Page' },
  { value: 'half', label: 'Half Page' },
  { value: 'quarter', label: '1/4 Page' },
  { value: 'third', label: '1/3 Page' },
];
const MAX_NOTES_WORDS = 500;

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function NewAdForm() {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [fileName, setFileName] = useState('');
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const notesWords = wordCount(notes);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const signed = await requestCustomerAdUploadUrl(file.name);
      if (!signed.ok || !signed.path || !signed.token) {
        setError(signed.error ?? 'Upload failed.');
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(AD_FILES_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }
      setPath(signed.path);
      setFileName(file.name);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!path) {
      setError('Upload your ad copy first.');
      return;
    }
    if (!size) {
      setError('Select a page size.');
      return;
    }
    if (notesWords > MAX_NOTES_WORDS) {
      setError(`Other Notes is limited to ${MAX_NOTES_WORDS} words.`);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await saveCustomerAd({
      storage_path: path,
      file_name: fileName,
      copy_size: size,
      notes,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    router.push('/ad-portal');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Ad Copy</label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className="rounded-lg border-2 border-dashed border-zinc-300 bg-white px-6 py-8 text-center"
        >
          {fileName ? (
            <p className="text-sm text-zinc-700">
              <span className="font-medium">{fileName}</span>
              <button
                type="button"
                onClick={() => {
                  setPath('');
                  setFileName('');
                }}
                className="ml-2 text-red-600 hover:underline"
              >
                remove
              </button>
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Drag &amp; drop your ad here, or</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {!fileName ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
            >
              {uploading ? 'Uploading…' : '+ Upload Copy'}
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Page Size</label>
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
        >
          <option value="">Select a size…</option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Other Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          placeholder="Anything the paper should know about this ad…"
        />
        <p className={`mt-1 text-xs ${notesWords > MAX_NOTES_WORDS ? 'text-red-600' : 'text-zinc-400'}`}>
          {notesWords}/{MAX_NOTES_WORDS} words
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save Ad'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
