'use client';

/**
 * ClassifiedEditor — editor for a `classifieds` template page (printed p22
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
import { saveClassifiedPage, requestClassifiedAdUploadUrl } from '../actions';

const PREVIEW_SCALE = 0.4;

let counter = 0;
function newId() {
  counter += 1;
  return `ca-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export type ClassifiedOption = {
  id: string;
  dateLabel: string;
  fileName: string | null;
  storagePath: string;
};

export function ClassifiedEditor({
  pageId,
  pageNumber,
  dateLabel,
  initialData,
  options,
}: {
  pageId: string;
  pageNumber: number;
  dateLabel?: string;
  initialData: ClassifiedPageData;
  options: ClassifiedOption[];
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

  // Overflow check: a column whose stacked ads exceed the page area gets
  // clipped on print — measure the preview's columns and warn.
  useEffect(() => {
    const t = setTimeout(() => {
      const cols = previewRef.current?.querySelectorAll('[data-classified-column]') ?? [];
      let over = false;
      cols.forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 2) over = true;
      });
      setOverflowing(over);
    }, 400); // give the ad images a beat to load
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Controls ───────────────────────────────────────── */}
      <div className="max-w-xl space-y-5">
        <p className="text-sm text-zinc-600">
          Drop the ad PDFs advertisers send (artwork centered on a blank page) — the artwork is
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
              Fills the whole page with one uploaded file — only used when no individual ads are
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
                  {o.fileName ? ` — ${o.fileName}` : ''}
                </option>
              ))}
            </select>
            {options.length === 0 ? (
              <p className="text-[11px] text-zinc-400">
                No classifieds uploaded yet — add one in{' '}
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
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠ A column&rsquo;s ads are taller than the page — the overflow is clipped on print. Move
            an ad to the other column or to the next classifieds page.
          </div>
        ) : null}
      </div>
    </div>
  );
}
