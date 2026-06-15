'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  requestLegalUploadUrl,
  createLegalAction,
  deleteLegalAction,
} from './actions';

const BUCKET = 'legals';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type LegalRow = {
  id: string;
  iso: string;
  dateLabel: string;
  url: string;
  fileName: string | null;
};

export function LegalsAdmin({ legals }: { legals: LegalRow[] }) {
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

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

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
      const signed = await requestLegalUploadUrl();
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
      const saved = await createLegalAction({
        year,
        month,
        day,
        storage_path: signed.path,
        file_name: file.name,
      });
      if (!saved.ok) {
        setError(saved.error ?? 'Could not save the legal.');
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
    if (!confirm(`Delete the legal dated ${label}? This can't be undone.`)) return;
    const res = await deleteLegalAction(id);
    if (!res.ok) {
      setError(res.error ?? 'Could not delete.');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600">
          Upload the weekly legal-notice PDF. It appears here and on the public
          Legals page immediately.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAdd((v) => !v);
            setError(null);
          }}
          className="shrink-0 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold rounded transition-colors"
        >
          {showAdd ? '× Close' : '+ Add New Legal File'}
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
              <p className="text-sm text-zinc-500">
                Drag &amp; drop a PDF here, or
              </p>
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
            <div
              role="alert"
              className="mt-4 max-w-md text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleAdd}
            disabled={uploading || !file}
            className="mt-4 inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            {uploading ? 'Uploading…' : 'Save Legal File'}
          </button>
        </div>
      ) : null}

      {error && !showAdd ? (
        <div
          role="alert"
          className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-widest text-zinc-500">
              <th className="py-2 pr-4 font-semibold">Date</th>
              <th className="py-2 pr-4 font-semibold">Link</th>
              <th className="py-2 font-semibold text-right">Delete</th>
            </tr>
          </thead>
          <tbody>
            {legals.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-zinc-500">
                  No legals uploaded yet.
                </td>
              </tr>
            ) : (
              legals.map((l) => (
                <tr key={l.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4 text-zinc-900 whitespace-nowrap">{l.dateLabel}</td>
                  <td className="py-3 pr-4">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-red hover:underline"
                    >
                      {l.dateLabel.toUpperCase()} LEGAL PDF
                    </a>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(l.id, l.dateLabel)}
                      className="inline-flex items-center px-3 py-1.5 text-red-700 border border-red-300 hover:bg-red-50 text-xs font-medium rounded transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
  onChange: (v: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full rounded border border-zinc-300 bg-white px-2 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      >
        {children}
      </select>
    </div>
  );
}
