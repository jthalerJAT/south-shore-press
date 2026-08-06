'use client';

/**
 * AdPicker — the "+ Upload Ad" destination for a full-page-ad page. Left: the
 * Ad Database as accounts → copy files (drag a copy or click to place). Right:
 * a drop-zone where the editor can drag a copy from the list OR drop / upload
 * a file from their PC. Either action designates the page's creative and
 * returns to the page editor.
 */
import { useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { FullAdData } from '@/lib/newspaper/full-ad';
import type { Ad } from '@/lib/queries/ads';
import { adSizeLabel, fmtAdDate } from '../../ad-copy-picker';
import { addAdToPage, saveFullAd, requestAdUploadUrl } from '../../actions';

const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';

const DRAG_KEY = 'text/ssp-ad-id';

export function AdPicker({
  pageId,
  ads,
  initialData,
}: {
  pageId: string;
  ads: Ad[];
  initialData: FullAdData;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Account names (alphabetical) → their copies (newest first).
  const clients = useMemo(() => {
    const byName = new Map<string, Ad[]>();
    for (const a of ads) {
      const list = byName.get(a.business_name) ?? [];
      list.push(a);
      byName.set(a.business_name, list);
    }
    return Array.from(byName.entries())
      .sort(([x], [y]) => x.localeCompare(y, 'en', { sensitivity: 'base' }))
      .map(([name, copies]) => ({
        name,
        copies: copies.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }));
  }, [ads]);

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
      {/* Accounts → copies */}
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Ad Database</div>
        <ul className="border border-zinc-200 rounded divide-y divide-zinc-100 bg-white max-h-[70vh] overflow-y-auto">
          {clients.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-zinc-400">
              No clients yet. Add them in the Ad Database.
            </li>
          ) : (
            clients.map(({ name, copies }) => {
              const open = openClient === name;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setOpenClient(open ? null : name)}
                    className="w-full px-3 py-2 flex items-center gap-1.5 text-left hover:bg-zinc-50 transition-colors"
                  >
                    {open ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    )}
                    <span className="text-[13px] font-medium text-zinc-900 truncate">{name}</span>
                    <span className="ml-auto text-[11px] text-zinc-400">{copies.length}</span>
                  </button>
                  {open ? (
                    <ul className="pb-1">
                      {copies.map((a) => (
                        <li
                          key={a.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData(DRAG_KEY, a.id)}
                          onClick={() => !busy && pickAd(a.id)}
                          className="pl-8 pr-3 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
                          title="Drag to the page, or click to place"
                        >
                          <div className="text-[12px] text-zinc-800 truncate">
                            {a.copy_file_name || 'Copy file'}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {adSizeLabel(a.copy_size)} · {fmtAdDate(a.created_at)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Drop zone */}
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2">Full Page Ad</div>
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
            {busy ? 'Working…' : 'Drag a copy here, drop a file, or'}
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
