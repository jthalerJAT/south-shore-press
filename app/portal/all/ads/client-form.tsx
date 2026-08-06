'use client';

/**
 * New-client form: contact details plus optional initial uploads. Uploading a
 * copy file prompts for its Copy Size (full / half / third / quarter) — the
 * size travels with that file and drives how big it renders when placed.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskPhoneInput } from '@/lib/phone';
import { AD_SIZES } from '@/lib/newspaper-templates';
import type { AdFileKind } from '@/lib/queries/ad-clients';
import { createAdClient, type NewFileInput } from './actions';
import { uploadAdFile } from './upload-client';

type PendingFile = NewFileInput & { needsSize?: boolean };

const KIND_LABEL: Record<AdFileKind, string> = {
  copy: 'Copy',
  insert_order: 'Insert Order',
  contract: 'Contract',
};

export function ClientForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploadingKind, setUploadingKind] = useState<AdFileKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyRef = useRef<HTMLInputElement | null>(null);
  const insertRef = useRef<HTMLInputElement | null>(null);
  const contractRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(kind: AdFileKind, file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingKind(kind);
    const uploadKind = kind === 'insert_order' ? 'insert' : kind;
    const res = await uploadAdFile(uploadKind, file);
    setUploadingKind(null);
    if (!res.ok) {
      setError(res.error ?? 'Upload failed.');
      return;
    }
    setFiles((list) => [
      ...list,
      {
        kind,
        storage_path: res.path!,
        file_name: res.fileName!,
        // Copy needs an explicit size before the client can be created.
        copy_size: kind === 'copy' ? '' : undefined,
        needsSize: kind === 'copy',
      },
    ]);
  }

  function setSize(index: number, size: string) {
    setFiles((list) =>
      list.map((f, i) => (i === index ? { ...f, copy_size: size, needsSize: !size } : f))
    );
  }

  function removeFile(index: number) {
    setFiles((list) => list.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!businessName.trim()) {
      setError('Business name is required.');
      return;
    }
    const missingSize = files.some((f) => f.kind === 'copy' && !f.copy_size);
    if (missingSize) {
      setError('Select a Copy Size for every uploaded copy.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createAdClient(
      {
        business_name: businessName,
        contact_name: contactName,
        contact_phone: phone,
        contact_email: email,
      },
      files.map(({ needsSize: _needsSize, ...f }) => f)
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not create the client.');
      return;
    }
    router.push(`/portal/all/ads/${res.id}`);
    router.refresh();
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

      <div className="pt-2">
        <label className="block text-sm font-medium text-zinc-700 mb-2">Files</label>
        <div className="flex flex-wrap gap-2">
          <input
            ref={copyRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              handleFile('copy', e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <input
            ref={insertRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              handleFile('insert_order', e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <input
            ref={contractRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              handleFile('contract', e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <UploadButton
            label="+ Upload Copy"
            busy={uploadingKind === 'copy'}
            disabled={uploadingKind !== null}
            onClick={() => copyRef.current?.click()}
          />
          <UploadButton
            label="+ Upload Insert Order"
            busy={uploadingKind === 'insert_order'}
            disabled={uploadingKind !== null}
            onClick={() => insertRef.current?.click()}
          />
          <UploadButton
            label="+ Upload Contract"
            busy={uploadingKind === 'contract'}
            disabled={uploadingKind !== null}
            onClick={() => contractRef.current?.click()}
          />
        </div>

        {files.length > 0 ? (
          <ul className="mt-3 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
            {files.map((f, i) => (
              <li key={`${f.storage_path}-${i}`} className="px-3 py-2 flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 w-24 shrink-0">
                  {KIND_LABEL[f.kind]}
                </span>
                <span className="text-sm text-zinc-800 truncate flex-1">{f.file_name}</span>
                {f.kind === 'copy' ? (
                  <select
                    value={f.copy_size ?? ''}
                    onChange={(e) => setSize(i, e.target.value)}
                    className={`rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-red ${
                      f.copy_size ? 'border-zinc-300' : 'border-red-400 text-red-600'
                    }`}
                  >
                    <option value="">Select Copy Size…</option>
                    {AD_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-xs text-red-600 hover:underline shrink-0"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploadingKind !== null}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Create Client'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}

function UploadButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded transition-colors"
    >
      {busy ? 'Uploading…' : label}
    </button>
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
