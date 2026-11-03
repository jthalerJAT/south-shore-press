'use client';

/**
 * ClassifiedEditor - editor for a `classifieds` template page (printed p22
 * format). "+ Add Classified" accepts the PDF an advertiser sends (ad artwork
 * centered on a blank page) via drag-drop or file picker: the artwork is
 * cropped out of the PDF client-side (pdf.js render → white-margin trim) and
 * uploaded as a PNG. Placed ads stack in two columns, top/bottom-justified
 * with automatic spacing; each ad has a column picker + reorder/remove. The
 * legacy whole-page-file picker remains for pages built the old way.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { createClient } from '@/lib/supabase/client';
import { ClassifiedPage } from '@/components/newspaper/classified-page';
import {
  classifiedFileUrl,
  fillClassifiedFromRecord,
  CLASSIFIEDS_BUCKET_PUBLIC,
  type ClassifiedAd,
  type ClassifiedPageData,
} from '@/lib/newspaper/classified';
import {
  saveClassifiedPage,
  requestClassifiedAdUploadUrl,
  addClassifiedToLibrary,
} from '../actions';

const PREVIEW_SCALE = 0.4;

let counter = 0;
function newId() {
  counter += 1;
  return `ca-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export type ClassifiedOption = {
  id: string;
  /** ISO date (YYYY-MM-DD) for reverse-chrono sorting. */
  iso: string;
  dateLabel: string;
  fileName: string | null;
  storagePath: string;
};

export type ClassifiedLibraryOption = {
  id: string;
  storagePath: string;
  fileName: string | null;
  /** ISO date (YYYY-MM-DD) for reverse-chrono sorting. */
  iso: string;
  dateLabel: string;
};

export function ClassifiedEditor({
  pageId,
  pageNumber,
  dateLabel,
  initialData,
  options,
  library,
}: {
  pageId: string;
  pageNumber: number;
  dateLabel?: string;
  initialData: ClassifiedPageData;
  options: ClassifiedOption[];
  /** Previously uploaded individual ads (migration 057) - reusable without
   *  re-uploading, since the same ads run most weeks. */
  library: ClassifiedLibraryOption[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ClassifiedPageData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const ads = data.ads ?? [];

  function touch() {
    setSaved(false);
  }
  function patchAd(id: string, patch: Partial<ClassifiedAd>) {
    touch();
    setData((d) => ({ ...d, ads: (d.ads ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }
  function removeAd(id: string) {
    touch();
    setData((d) => ({ ...d, ads: (d.ads ?? []).filter((a) => a.id !== id) }));
  }
  function moveAd(id: string, dir: -1 | 1) {
    touch();
    setData((d) => {
      const list = d.ads ?? [];
      const idx = list.findIndex((a) => a.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= list.length) return d;
      const next = [...list];
      const [a] = next.splice(idx, 1);
      next.splice(to, 0, a);
      return { ...d, ads: next };
    });
  }

  async function addFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      // Heavy canvas/pdf.js code loads only when actually adding an ad.
      const { extractClassifiedAd } = await import('@/lib/newspaper/classified-crop');
      const supabase = createClient();
      for (const file of Array.from(files)) {
        const { blob } = await extractClassifiedAd(file);
        const signed = await requestClassifiedAdUploadUrl();
        if (!signed.ok || !signed.path || !signed.token) {
          setError(signed.error ?? 'Upload failed.');
          return;
        }
        const { error: upErr } = await supabase.storage
          .from(CLASSIFIEDS_BUCKET_PUBLIC)
          .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: 'image/png' });
        if (upErr) {
          setError(`Upload failed: ${upErr.message}`);
          return;
        }
        // Remember the ad in the reuse library for future weeks (non-fatal).
        void addClassifiedToLibrary({ storage_path: signed.path, file_name: file.name });
        touch();
        setData((d) => {
          const list = d.ads ?? [];
          // New ads go to whichever column currently has fewer.
          const c1 = list.filter((a) => a.column === 1).length;
          const c2 = list.filter((a) => a.column === 2).length;
          const ad: ClassifiedAd = {
            id: newId(),
            storage_path: signed.path!,
            file_name: file.name,
            column: c1 <= c2 ? 1 : 2,
          };
          return { ...d, ads: [...list, ad] };
        });
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `Could not read the ad: ${e.message}`
          : 'Could not read the ad file. Is it a valid PDF or image?'
      );
    } finally {
      setUploading(false);
    }
  }

  // The "Add Classified from Database" dropdown: every ad placed on a
  // classifieds page before (the reuse library) PLUS every file uploaded on
  // the Classified Upload tile, merged reverse-chrono. Tile files whose name
  // matches a library ad are left out - the library copy is already cropped.
  const libraryNames = new Set(
    library.map((o) => (o.fileName ?? '').toLowerCase()).filter(Boolean)
  );
  const databaseEntries = [
    ...library.map((o) => ({
      key: `lib:${o.id}`,
      iso: o.iso,
      label: `${o.fileName ?? 'Classified ad'} (${o.dateLabel})`,
    })),
    ...options
      .filter((o) => !(o.fileName && libraryNames.has(o.fileName.toLowerCase())))
      .map((o) => ({
        key: `up:${o.id}`,
        iso: o.iso,
        label: `${o.fileName ?? 'Classified file'} (${o.dateLabel})`,
      })),
  ].sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));

  /** A Classified Upload tile file: fetch it and run it through the same
   *  crop-and-place pipeline as a fresh drag-drop. */
  async function addFromUpload(id: string) {
    const rec = options.find((o) => o.id === id);
    if (!rec) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(classifiedFileUrl(rec.storagePath));
      if (!res.ok) throw new Error(`could not load the file (HTTP ${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], rec.fileName ?? 'classified.pdf', {
        type: blob.type || 'application/pdf',
      });
      await addFiles([file]);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `Could not add the classified: ${e.message}`
          : 'Could not add that classified file.'
      );
    } finally {
      setUploading(false);
    }
  }

  function pickFromDatabase(key: string) {
    if (key.startsWith('lib:')) addFromLibrary(key.slice(4));
    else if (key.startsWith('up:')) void addFromUpload(key.slice(3));
  }

  function addFromLibrary(id: string) {
    const rec = library.find((o) => o.id === id);
    if (!rec) return;
    touch();
    setData((d) => {
      const list = d.ads ?? [];
      const c1 = list.filter((a) => a.column === 1).length;
      const c2 = list.filter((a) => a.column === 2).length;
      const ad: ClassifiedAd = {
        id: newId(),
        storage_path: rec.storagePath,
        file_name: rec.fileName ?? undefined,
        column: c1 <= c2 ? 1 : 2,
      };
      return { ...d, ads: [...list, ad] };
    });
  }

  function pickLegacy(id: string) {
    const rec = options.find((o) => o.id === id);
    if (!rec) return;
    touch();
    setData((d) => fillClassifiedFromRecord(d, { id: rec.id, storage_path: rec.storagePath, file_name: rec.fileName }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveClassifiedPage(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  // Auto-fit means nothing ever clips - instead warn when a column had to
  // shrink its ads substantially (they may print smaller than intended).
  useEffect(() => {
    const t = setTimeout(() => {
      const cols = previewRef.current?.querySelectorAll('[data-classified-column]') ?? [];
      let cramped = false;
      cols.forEach((el) => {
        const s = parseFloat(el.getAttribute('data-fit-scale') ?? '1');
        if (s < 0.67) cramped = true;
      });
      setOverflowing(cramped);
    }, 600); // give the ad images a beat to load + the fit a beat to settle
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Controls ───────────────────────────────────────── */}
      <div className="max-w-xl space-y-5">
        <p className="text-sm text-zinc-600">
          Drop the ad PDFs advertisers send (artwork centered on a blank page) - the artwork is
          cropped out automatically and stacked in two columns. The first ad in a column sits flush
          to the top and the last flush to the bottom; the spacing between is created automatically
          to preserve that alignment. Images (JPG/PNG) work too.
        </p>

        {/* + Add Classified dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? 'border-brand-red bg-red-50' : 'border-zinc-300 bg-white'
          }`}
        >
          <div className="text-sm text-zinc-600 mb-3">
            {uploading ? 'Extracting the ad from the PDF…' : 'Drag a classified PDF (or image) here'}
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {uploading ? 'Working…' : '+ Add Classified'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Place a stored classified - no re-upload needed */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Add Classified from Database
          </div>
          <select
            value=""
            disabled={uploading}
            onChange={(e) => {
              if (e.target.value) pickFromDatabase(e.target.value);
              e.target.value = '';
            }}
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none disabled:opacity-60"
          >
            <option value="">
              {databaseEntries.length === 0
                ? 'No classifieds in the database yet - uploads are remembered automatically'
                : 'Select a classified file...'}
            </option>
            {databaseEntries.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-400">
            Lists every file in the Classified Upload tile plus every ad placed on a classifieds
            page before, newest first. Selecting adds it to the page (a file picked from the
            upload tile is cropped first, which takes a moment); it can be placed on both
            classifieds pages.
          </p>
        </div>

        {/* Placed ads */}
        {ads.length > 0 ? (
          <div className="space-y-3">
            {ads.map((ad, i) => (
              <div key={ad.id} className="rounded-lg border border-zinc-200 bg-white p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={classifiedFileUrl(ad.storage_path)}
                  alt=""
                  className="w-16 h-16 object-contain border border-zinc-100 rounded bg-white shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-700 truncate">
                    {ad.file_name ?? 'Classified ad'}
                  </div>
                  <select
                    value={ad.column}
                    onChange={(e) => patchAd(ad.id, { column: e.target.value === '2' ? 2 : 1 })}
                    className="mt-1 rounded border border-zinc-300 px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
                  >
                    <option value={1}>Column 1 (left)</option>
                    <option value={2}>Column 2 (middle)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => moveAd(ad.id, -1)} disabled={i === 0} className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveAd(ad.id, 1)} disabled={i === ads.length - 1} className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => removeAd(ad.id)} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No classifieds on this page yet.</p>
        )}

        {/* Legacy whole-page file */}
        <details className="rounded-lg border border-zinc-200 bg-white p-3">
          <summary className="text-xs font-bold uppercase tracking-widest text-zinc-500 cursor-pointer">
            Full-page classified file (legacy)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-zinc-500">
              Fills the whole page with one uploaded file - only used when no individual ads are
              placed above.
            </p>
            <select
              value={data.classified_id ?? ''}
              onChange={(e) => e.target.value && pickLegacy(e.target.value)}
              className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
            >
              <option value="">Select an uploaded classified…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.dateLabel}
                  {o.fileName ? ` - ${o.fileName}` : ''}
                </option>
              ))}
            </select>
            {options.length === 0 ? (
              <p className="text-[11px] text-zinc-400">
                No classifieds uploaded yet - add one in{' '}
                <Link href="/portal/all/classifieds" className="text-brand-red hover:underline">
                  Classified Upload
                </Link>
                .
              </p>
            ) : null}
            {data.storage_path ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700">{data.file_name || 'Classified placed'}</span>
                <button
                  type="button"
                  onClick={() => {
                    touch();
                    setData((d) => ({ ...d, classified_id: undefined, storage_path: undefined, file_name: undefined }));
                  }}
                  className="px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </details>

        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {saving ? 'Saving…' : 'Save Page'}
          </button>
          <Link
            href={`/portal/all/newspaper-creator/${pageId}/print`}
            target="_blank"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            View / Print PDF
          </Link>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        </div>
      </div>

      {/* ── Live preview ───────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Preview</div>
        <div
          className="border border-zinc-300 shadow-sm overflow-hidden bg-white"
          style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <div ref={previewRef}>
              <ClassifiedPage data={data} pageNumber={pageNumber} dateLabel={dateLabel} editing />
            </div>
          </div>
        </div>
        {overflowing ? (
          <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ A column&rsquo;s ads were shrunk quite small to fit the page. Everything still prints
            in full - but consider moving an ad to the other column or the next classifieds page so
            they run larger.
          </div>
        ) : null}
      </div>
    </div>
  );
}
