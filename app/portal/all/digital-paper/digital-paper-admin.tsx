'use client';

/**
 * Digital Paper — every printed issue as a web-friendly PDF, newest first.
 * View / print (opens in the browser's PDF viewer), Download, Copy Link
 * (public URL — paste into an email), and admin-only Delete. "+ Add Issue"
 * uploads a new week: issue date + drag-drop PDF via a signed Storage URL
 * (same pattern as the Legals Upload page).
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, Link2, Trash2, Eye, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  requestDigitalPaperUploadUrl,
  createDigitalPaperAction,
  deleteDigitalPaperAction,
} from './actions';

const BUCKET = 'digital-papers';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type PaperRow = {
  id: string;
  iso: string;
  dateLabel: string;
  url: string;
  fileName: string | null;
  pageCount: number | null;
  sizeMb: number | null;
};

export function DigitalPaperAdmin({ papers, isAdmin }: { papers: PaperRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const now = new Date();

  const [showAdd, setShowAdd] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [year, setYear] = useState(now.getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1];

  function pickFile(f: File | null) {
    setError(null);
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setFile(f);
  }

  async function handleAdd() {
    setError(null);
    if (!file) {
      setError('Please attach a PDF.');
      return;
    }
    setUploading(true);
    try {
      const signed = await requestDigitalPaperUploadUrl();
      if (!signed.ok || !signed.path || !signed.token) {
        setError(signed.error ?? 'Could not start the upload.');
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: 'application/pdf',
        });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }
      const saved = await createDigitalPaperAction({
        year,
        month,
        day,
        storage_path: signed.path,
        file_name: file.name,
        file_size_bytes: file.size,
      });
      if (!saved.ok) {
        setError(saved.error ?? 'Could not save the issue.');
        return;
      }
      setShowAdd(false);
      setFile(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete the ${label} issue? This can't be undone.`)) return;
    const res = await deleteDigitalPaperAction(id);
    if (!res.ok) {
      setError(res.error ?? 'Could not delete.');
      return;
    }
    router.refresh();
  }

  async function copyLink(p: PaperRow) {
    try {
      await navigator.clipboard.writeText(p.url);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 2000);
    } catch {
      setError('Could not copy — long-press / right-click the View link instead.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 max-w-2xl">
          Every printed issue as a PDF, newest first — open it to read or print, download it, or
          Copy Link and paste into an email. These are the screen-friendly versions, not the
          high-res press files.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAdd((v) => !v);
            setError(null);
          }}
          className="shrink-0 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold rounded transition-colors"
        >
          {showAdd ? '× Close' : '+ Add Issue'}
        </button>
      </div>

      {showAdd ? (
        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-5">
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <Select label="Month" value={month} onChange={setMonth}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
            <Select label="Day" value={day} onChange={setDay}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <Select label="Year" value={year} onChange={setYear}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            The issue&rsquo;s cover date. Uploading to a date that already has a file replaces it.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`mt-4 max-w-md rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragOver ? 'border-brand-red bg-brand-red/5' : 'border-zinc-300 bg-white'
            }`}
          >
            {file ? (
              <p className="text-sm text-zinc-700">
                <span className="font-medium">{file.name}</span>{' '}
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-2 text-brand-red hover:underline"
                >
                  remove
                </button>
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Drag &amp; drop the issue PDF here, or</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium text-zinc-700 rounded transition-colors"
              >
                + Upload File
              </button>
            ) : null}
          </div>

          {error ? (
            <div role="alert" className="mt-4 max-w-md text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleAdd}
            disabled={uploading || !file}
            className="mt-4 inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {uploading ? 'Uploading…' : 'Save Issue'}
          </button>
        </div>
      ) : null}

      {error && !showAdd ? (
        <div role="alert" className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_7rem_6rem_16rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Issue</div>
          <div>Pages</div>
          <div>Size</div>
          <div className="text-right">Actions</div>
        </div>
        {papers.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-400">
            No issues yet — use + Add Issue to upload the first one.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {papers.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[1fr_7rem_6rem_16rem] items-center gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-sm font-medium text-zinc-900 truncate">{p.dateLabel}</span>
                </div>
                <div className="text-sm text-zinc-500">{p.pageCount ? `${p.pageCount} pages` : '—'}</div>
                <div className="text-sm text-zinc-500">{p.sizeMb ? `${p.sizeMb.toFixed(1)} MB` : '—'}</div>
                <div className="flex items-center justify-end gap-1.5">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
                    title="Open in a new tab — read or print from there"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </a>
                  <a
                    href={p.url}
                    download={`South Shore Press ${p.iso}.pdf`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
                    title="Download the PDF"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
                    title="Copy a shareable link — paste it into an email"
                  >
                    {copiedId === p.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.dateLabel)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded border border-zinc-300 text-red-600 hover:bg-red-50"
                      aria-label={`Delete ${p.dateLabel}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full rounded border border-zinc-300 px-2 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      >
        {children}
      </select>
    </label>
  );
}
