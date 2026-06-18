'use client';

/**
 * AdPicker — the "+ Upload Ad" destination for a full-page-ad page. Left: the Ad
 * Database list (draggable + clickable). Right: a drop-zone where the editor can
 * drag an ad from the list OR drop / upload a file from their PC. Either action
 * designates the page's creative and returns to the page editor.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { FullAdData } from '@/lib/newspaper/full-ad';
import { addAdToPage, saveFullAd, requestAdUploadUrl } from '../../actions';

const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';

type AdLite = {
  id: string;
  business_name: string;
  copy_file_name: string | null;
  copy_storage_path: string | null;
};

const DRAG_KEY = 'text/ssp-ad-id';

export function AdPicker({
  pageId,
  ads,
  initialData,
}: {
  pageId: string;
  ads: AdLite[];
  initialData: FullAdData;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function done() {
    router.push(`/portal/all/newspaper-creator/${pageId}`);
    router.refresh();
  }

  async function pickAd(adId: string) {
    setBusy(true);
    setError(null);
    const res = await addAdToPage(pageId, adId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not place the ad.');
      return;
    }
    done();
  }

  async function uploadFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await requestAdUploadUrl(file.name);
      if (!signed.ok || !signed.path || !signed.token) {
        setError(signed.error ?? 'Upload failed.');
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(NEWSPAPER_ADS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }
      const data: FullAdData = {
        ...initialData,
        storage_path: signed.path,
        file_name: file.name,
        copy_size: initialData.copy_size ?? 'full',
      };
      const res = await saveFullAd(pageId, data as unknown as Record<string, unknown>);
      if (!res.ok) {
        setError(res.error ?? 'Could not save.');
        return;
      }
      done();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6">
      {/* Ad list */}
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Ad Database</div>
        <ul className="border border-zinc-200 rounded divide-y divide-zinc-100 bg-white max-h-[70vh] overflow-y-auto">
          {ads.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-zinc-400">
              No ads yet. Add them in the Ad Database.
            </li>
          ) : (
            ads.map((a) => (
              <li
                key={a.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(DRAG_KEY, a.id)}
                onClick={() => !busy && pickAd(a.id)}
                className="px-3 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
                title="Drag to the page, or click to place"
              >
                <div className="text-[13px] font-medium text-zinc-900 truncate">{a.business_name}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
                  {a.copy_file_name || (a.copy_storage_path ? 'Copy on file' : 'No copy')}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Drop zone */}
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Page 3 — Full Page Ad</div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const adId = e.dataTransfer.getData(DRAG_KEY);
            if (adId) {
              pickAd(adId);
              return;
            }
            uploadFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white text-center transition-colors ${
            dragOver ? 'border-brand-red bg-red-50' : 'border-zinc-300'
          }`}
          style={{ minHeight: '60vh' }}
        >
          <p className="text-sm text-zinc-500 mb-3">
            {busy ? 'Working…' : 'Drag an ad here, drop a file, or'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            + Upload Ad
          </button>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
