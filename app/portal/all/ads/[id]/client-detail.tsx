'use client';

/**
 * Client page — the "folder view" root for one advertiser account.
 * Top: contact details (editable inline) + "+ New" buttons for each file kind.
 * Body: three folders (Ad Copy / Insert Orders / Contracts) with counts.
 * Uploading a new copy prompts for its Copy Size before saving.
 */
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Pencil } from 'lucide-react';
import { maskPhoneInput } from '@/lib/phone';
import { AD_SIZES } from '@/lib/newspaper-templates';
import type { AdClient, AdClientFile, AdFileKind } from '@/lib/queries/ad-clients';
import { addAdClientFile, updateAdClient } from '../actions';
import { uploadAdFile } from '../upload-client';

const FOLDERS: { kind: AdFileKind; slug: string; label: string }[] = [
  { kind: 'copy', slug: 'copy', label: 'Ad Copy' },
  { kind: 'insert_order', slug: 'insert-orders', label: 'Insert Orders' },
  { kind: 'contract', slug: 'contracts', label: 'Contracts' },
];

export function ClientDetail({
  client,
  files,
  isAdmin: _isAdmin,
}: {
  client: AdClient;
  files: AdClientFile[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploadingKind, setUploadingKind] = useState<AdFileKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A copy file that's uploaded but waiting for its size designation.
  const [pendingCopy, setPendingCopy] = useState<{ path: string; fileName: string } | null>(null);
  const [pendingSize, setPendingSize] = useState('');

  const [editing, setEditing] = useState(false);
  const [businessName, setBusinessName] = useState(client.business_name);
  const [contactName, setContactName] = useState(client.contact_name ?? '');
  const [phone, setPhone] = useState(maskPhoneInput(client.contact_phone ?? ''));
  const [email, setEmail] = useState(client.contact_email ?? '');
  const [savingContact, setSavingContact] = useState(false);

  const copyRef = useRef<HTMLInputElement | null>(null);
  const insertRef = useRef<HTMLInputElement | null>(null);
  const contractRef = useRef<HTMLInputElement | null>(null);

  function countFor(kind: AdFileKind): number {
    return files.filter((f) => f.kind === kind).length;
  }

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
    if (kind === 'copy') {
      // Prompt for the size before the file is recorded.
      setPendingCopy({ path: res.path!, fileName: res.fileName! });
      setPendingSize('');
      return;
    }
    startTransition(async () => {
      const saved = await addAdClientFile(client.id, {
        kind,
        storage_path: res.path!,
        file_name: res.fileName!,
      });
      if (!saved.ok) setError(saved.error ?? 'Could not save the file.');
      else router.refresh();
    });
  }

  function confirmPendingCopy() {
    if (!pendingCopy || !pendingSize) return;
    const { path, fileName } = pendingCopy;
    setPendingCopy(null);
    startTransition(async () => {
      const saved = await addAdClientFile(client.id, {
        kind: 'copy',
        storage_path: path,
        file_name: fileName,
        copy_size: pendingSize,
      });
      if (!saved.ok) setError(saved.error ?? 'Could not save the copy.');
      else router.refresh();
    });
  }

  async function saveContact() {
    setSavingContact(true);
    setError(null);
    const res = await updateAdClient(client.id, {
      business_name: businessName,
      contact_name: contactName,
      contact_phone: phone,
      contact_email: email,
    });
    setSavingContact(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      {/* Contact card + New buttons */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {editing ? (
            <div className="space-y-2 max-w-sm">
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="block w-full rounded border border-zinc-300 px-3 py-1.5 text-sm font-semibold focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name"
                className="block w-full rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                placeholder="(xxx) xxx-xxxx"
                inputMode="numeric"
                maxLength={14}
                className="block w-full rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email"
                className="block w-full rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveContact}
                  disabled={savingContact}
                  className="px-3 py-1.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wide rounded transition-colors"
                >
                  {savingContact ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-600 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {client.contact_name || <span className="italic text-zinc-400">No contact name</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-zinc-400 hover:text-zinc-700"
                  aria-label="Edit contact details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {client.contact_phone ? <div>{client.contact_phone}</div> : null}
              {client.contact_email ? <div>{client.contact_email}</div> : null}
            </div>
          )}
        </div>

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
          <TopButton
            label="+ New Copy"
            busy={uploadingKind === 'copy'}
            disabled={uploadingKind !== null}
            onClick={() => copyRef.current?.click()}
          />
          <TopButton
            label="+ New Insert Order"
            busy={uploadingKind === 'insert_order'}
            disabled={uploadingKind !== null}
            onClick={() => insertRef.current?.click()}
          />
          <TopButton
            label="+ New Contract"
            busy={uploadingKind === 'contract'}
            disabled={uploadingKind !== null}
            onClick={() => contractRef.current?.click()}
          />
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      {/* Folders */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FOLDERS.map((f) => (
          <Link
            key={f.kind}
            href={`/portal/all/ads/${client.id}/${f.slug}`}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 py-10 hover:border-brand-red hover:shadow-sm transition-all"
          >
            <Folder className="w-10 h-10 text-brand-red" strokeWidth={1.5} />
            <div className="text-sm font-semibold text-zinc-900">{f.label}</div>
            <div className="text-xs text-zinc-500">
              {countFor(f.kind)} file{countFor(f.kind) === 1 ? '' : 's'}
            </div>
          </Link>
        ))}
      </div>

      {/* Copy Size prompt */}
      {pendingCopy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-900">Select Copy Size</h3>
            <p className="mt-1 text-xs text-zinc-500 truncate">{pendingCopy.fileName}</p>
            <select
              value={pendingSize}
              onChange={(e) => setPendingSize(e.target.value)}
              className="mt-4 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              <option value="">Choose a size…</option>
              {AD_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingCopy(null)}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingCopy}
                disabled={!pendingSize}
                className="px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
              >
                Save Copy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopButton({
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
      className="inline-flex items-center px-3 py-1.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
    >
      {busy ? 'Uploading…' : label}
    </button>
  );
}
