'use client';

/**
 * FullAdEditor — the bespoke editor for a full-page-ad template page. Left: the
 * ad-creator fields (business / contact / copy file / copy size), each editable
 * as an independent snapshot, plus a top "+ Upload Ad" button that opens the ad
 * picker. Right: a live to-scale FullPageAd preview. Save persists template_data
 * + locks the page.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { maskPhoneInput } from '@/lib/phone';
import { createClient } from '@/lib/supabase/client';
import { AD_SIZES } from '@/lib/newspaper-templates';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { FullPageAd } from '@/components/newspaper/full-page-ad';
import type { FullAdData } from '@/lib/newspaper/full-ad';
import { saveFullAd, requestAdUploadUrl } from '../actions';

const PREVIEW_SCALE = 0.4;
const NEWSPAPER_ADS_BUCKET = 'newspaper-ads';

/** Ad Database row, trimmed to what the placement dropdown needs. */
export type AdOption = {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  copy_storage_path: string | null;
  copy_file_name: string | null;
  copy_size: string | null;
};

export function FullAdEditor({
  pageId,
  pageNumber,
  dateLabel,
  initialData,
  ads = [],
}: {
  pageId: string;
  pageNumber?: number;
  dateLabel?: string;
  initialData: FullAdData;
  ads?: AdOption[];
}) {
  const router = useRouter();
  const [data, setData] = useState<FullAdData>(initialData);

  // Dropdown: place an existing ad from the Ad Database. Fills every field
  // (business, contacts, copy file, copy size) into the form as an unsaved
  // draft — the editor reviews the preview and hits Save Page to commit.
  function placeFromDatabase(adId: string) {
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return;
    if (!ad.copy_storage_path) {
      setError(`"${ad.business_name}" has no copy uploaded yet — add the file on its page in the Ad Database first.`);
      return;
    }
    setError(null);
    setSaved(false);
    setData((d) => ({
      ...d,
      business_name: ad.business_name,
      contact_name: ad.contact_name ?? undefined,
      contact_phone: ad.contact_phone ?? undefined,
      contact_email: ad.contact_email ?? undefined,
      storage_path: ad.copy_storage_path ?? undefined,
      file_name: ad.copy_file_name ?? undefined,
      copy_size:
        ad.copy_size === 'full' || ad.copy_size === 'half' || ad.copy_size === 'third' || ad.copy_size === 'quarter'
          ? ad.copy_size
          : d.copy_size ?? 'full',
    }));
  }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function set<K extends keyof FullAdData>(k: K, v: FullAdData[K]) {
    setSaved(false);
    setData((d) => ({ ...d, [k]: v }));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
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
      setSaved(false);
      setData((d) => ({ ...d, storage_path: signed.path, file_name: file.name }));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveFullAd(pageId, data as unknown as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
      {/* ── Fields ─────────────────────────────────────────── */}
      <div className="max-w-xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Place an ad from the Ad Database
          </label>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) placeFromDatabase(e.target.value);
              e.target.value = '';
            }}
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          >
            <option value="">Choose an existing ad…</option>
            {ads.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.copy_storage_path}>
                {a.business_name}
                {a.copy_file_name ? ` — ${a.copy_file_name}` : a.copy_storage_path ? '' : ' (no copy uploaded)'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-zinc-400">
            Fills the fields below from the Ad Database — review the preview, then Save Page.
          </p>
        </div>

        <Link
          href={`/portal/all/newspaper-creator/${pageId}/ad-picker`}
          className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          + Upload Ad
        </Link>

        <TextField label="Business Name" value={data.business_name ?? ''} onChange={(v) => set('business_name', v)} />
        <TextField label="Contact Name" value={data.contact_name ?? ''} onChange={(v) => set('contact_name', v)} />
        <div>
          <label className="block text-sm font-medium text-zinc-700">Contact Phone Number</label>
          <input
            value={data.contact_phone ?? ''}
            onChange={(e) => set('contact_phone', maskPhoneInput(e.target.value))}
            placeholder="(xxx) xxx-xxxx"
            inputMode="numeric"
            maxLength={14}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <TextField label="Contact Email Address" value={data.contact_email ?? ''} onChange={(v) => set('contact_email', v)} type="email" />

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Copy</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className="rounded-lg border-2 border-dashed border-zinc-300 bg-white px-6 py-6 text-center"
          >
            {data.file_name ? (
              <p className="text-sm text-zinc-700">
                <span className="font-medium">{data.file_name}</span>
                <button
                  type="button"
                  onClick={() => { setSaved(false); setData((d) => ({ ...d, storage_path: undefined, file_name: undefined })); }}
                  className="ml-2 text-red-600 hover:underline"
                >
                  remove
                </button>
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Drag &amp; drop the ad here, or</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {!data.file_name ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-3 inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
              >
                {uploading ? 'Uploading…' : '+ Upload Copy'}
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Copy Size</label>
          <select
            value={data.copy_size ?? 'full'}
            onChange={(e) => set('copy_size', e.target.value)}
            className="mt-1 block w-full max-w-xs rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
          >
            {AD_SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
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
            <FullPageAd data={data} pageNumber={pageNumber} dateLabel={dateLabel} editing />
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}
