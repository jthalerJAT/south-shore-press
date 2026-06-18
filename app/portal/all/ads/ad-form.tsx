'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskPhoneInput } from '@/lib/phone';
import { adFilePublicUrl } from '@/lib/ad-files';
import { AD_SIZES } from '@/lib/newspaper-templates';
import type { Ad } from '@/lib/queries/ads';
import { createAd, updateAd } from './actions';
import { uploadAdFile } from './upload-client';

export function AdForm({ mode, ad }: { mode: 'create' | 'edit'; ad?: Ad }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(ad?.business_name ?? '');
  const [contactName, setContactName] = useState(ad?.contact_name ?? '');
  const [phone, setPhone] = useState(maskPhoneInput(ad?.contact_phone ?? ''));
  const [email, setEmail] = useState(ad?.contact_email ?? '');
  const [copyPath, setCopyPath] = useState(ad?.copy_storage_path ?? '');
  const [copyName, setCopyName] = useState(ad?.copy_file_name ?? '');
  const [copySize, setCopySize] = useState(ad?.copy_size ?? 'quarter');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    const res = await uploadAdFile('copy', file);
    setUploading(false);
    if (!res.ok) {
      setError(res.error ?? 'Upload failed.');
      return;
    }
    setCopyPath(res.path!);
    setCopyName(res.fileName!);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const input = {
      business_name: businessName,
      contact_name: contactName,
      contact_phone: phone,
      contact_email: email,
      copy_storage_path: copyPath,
      copy_file_name: copyName,
      copy_size: copySize,
    };
    const res = mode === 'create' ? await createAd(input) : await updateAd(ad!.id, input);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    if (mode === 'create' && 'id' in res && res.id) {
      router.push(`/portal/all/ads/${res.id}`);
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Field label="Business Name" value={businessName} onChange={setBusinessName} required />
      <Field label="Contact Name" value={contactName} onChange={setContactName} />
      <div>
        <label className="block text-sm font-medium text-zinc-700">Contact Phone Number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
          placeholder="(xxx) xxx-xxxx"
          inputMode="numeric"
          maxLength={14}
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>
      <Field label="Contact Email Address" value={email} onChange={setEmail} type="email" />

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
          {copyName ? (
            <p className="text-sm text-zinc-700">
              <span className="font-medium">{copyName}</span>
              {copyPath ? (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => window.open(adFilePublicUrl(copyPath), '_blank')}
                    className="ml-1 text-brand-red hover:underline"
                  >
                    view
                  </button>
                </>
              ) : null}{' '}
              <button
                type="button"
                onClick={() => {
                  setCopyPath('');
                  setCopyName('');
                }}
                className="ml-1 text-red-600 hover:underline"
              >
                remove
              </button>
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Drag &amp; drop the ad copy here, or</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {!copyName ? (
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
        <div className="mt-3">
          <label className="block text-sm font-medium text-zinc-700">Copy Size</label>
          <select
            value={copySize}
            onChange={(e) => {
              setCopySize(e.target.value);
              setSaved(false);
            }}
            className="mt-1 block w-full max-w-xs rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            {AD_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Drives how large the ad renders when placed on a page.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create Ad' : 'Save Ad'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}
