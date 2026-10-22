'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/account-types';
import { Overlay } from './export-dialog';
import {
  clearAccountsByType,
  insertAccountBatch,
  assignMissingAccountNumbers,
  type ImportAccountRow,
} from './actions';
import {
  FIELD_LABELS,
  parseAccountsWorkbook,
  type Field,
  type ParsedRow,
  type ParseResult,
} from '@/lib/accounts/import-parse';
import type { WorkerIn, WorkerOut } from './import-worker';

const CHUNK = 1000;

export function ImportAccountsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [importType, setImportType] = useState<AccountType>('mailer');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [mappedFields, setMappedFields] = useState<Field[]>([]);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const typeLabel = ACCOUNT_TYPES.find((t) => t.value === importType)?.label ?? importType;

  /** Parse in a Worker so a 14k-row list can't freeze the tab. Falls back to
   *  parsing inline if the browser (or a stale bundle) can't start one. */
  function parseInWorker(buf: ArrayBuffer, onProgress: (n: number) => void) {
    return new Promise<ParseResult>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./import-worker.ts', import.meta.url));
      } catch (e) {
        reject(e);
        return;
      }
      worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
        if (ev.data.type === 'progress') {
          onProgress(ev.data.rowsDone);
          return;
        }
        worker.terminate();
        resolve(ev.data.result);
      };
      worker.onerror = (ev) => {
        worker.terminate();
        reject(ev.error ?? new Error('worker failed'));
      };
      // Transfer the bytes rather than copying them.
      worker.postMessage({ buf } satisfies WorkerIn, [buf]);
    });
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setDone(null);
    setRows(null);
    setFileName(file.name);
    setProgress('');
    setParsing(true);
    try {
      let result: ParseResult;
      try {
        result = await parseInWorker(await file.arrayBuffer(), (n) =>
          setProgress(`Read ${n.toLocaleString()} rows…`)
        );
      } catch (workerErr) {
        // No worker available - parse inline (slower, and the tab will sit
        // still while it runs, but the import still works).
        console.warn('[import] worker unavailable, parsing inline', workerErr);
        setProgress('Reading (this can take a minute on a large file)…');
        const XLSX = await import('xlsx');
        result = parseAccountsWorkbook(XLSX, await file.arrayBuffer());
      }
      setProgress('');
      if (!result.ok) {
        setError(result.error);
        setParsing(false);
        return;
      }
      setRows(result.rows);
      setMappedFields(result.fields);
      setParsing(false);
    } catch (e) {
      console.error('[import parse]', e);
      setError('Could not read that file. Use an .xlsx, .xls, or .csv export.');
      setProgress('');
      setParsing(false);
    }
  }

  async function runImport() {
    if (!rows || rows.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress('');
    try {
      if (mode === 'replace') {
        setProgress(`Clearing existing ${typeLabel} accounts…`);
        const cleared = await clearAccountsByType([importType]);
        if (!cleared.ok) {
          setError(cleared.error ?? 'Could not clear existing accounts.');
          setBusy(false);
          return;
        }
      }
      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk: ImportAccountRow[] = rows
          .slice(i, i + CHUNK)
          .map((r) => ({ account_type: importType, ...r }));
        const res = await insertAccountBatch(chunk);
        if (!res.ok) {
          setError(`${res.error ?? 'Import failed.'} (${inserted.toLocaleString()} imported before the error.)`);
          setBusy(false);
          router.refresh();
          return;
        }
        inserted += res.inserted ?? chunk.length;
        setProgress(`Imported ${inserted.toLocaleString()} of ${rows.length.toLocaleString()}…`);
      }
      // Number any rows that came in without an account number.
      await assignMissingAccountNumbers();
      setDone(`Imported ${inserted.toLocaleString()} ${typeLabel} account${inserted === 1 ? '' : 's'}.`);
      setBusy(false);
      router.refresh();
    } catch (e) {
      console.error('[import run]', e);
      setError('Import failed unexpectedly.');
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <Overlay title="Import Accounts" onClose={busy ? () => {} : onClose}>
      {done ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {done}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-600">
            Drop an Excel or CSV export (e.g. a SimpleCirc mailer or paid-subscriber list). Columns
            are matched by name - first/last name, company, address 1/2, city, state, zip, email,
            phone, ACS keyline, account ID, start/expiration dates. A separate &ldquo;Zip 4&rdquo;
            column is added onto the ZIP (11968 + 5339 → 11968-5339).
          </p>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700">Import these accounts as</label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as AccountType)}
              className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Every row in this file is created with this type. Import each cohort separately (e.g.
              the mailer list as Weekly Mailer, a paid export as a paid type).
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className="mt-4 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center"
          >
            {fileName ? (
              <p className="flex items-center justify-center gap-2 text-sm text-zinc-700">
                <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
                <span className="font-medium">{fileName}</span>
              </p>
            ) : (
              <p className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                <UploadCloud className="h-5 w-5" /> Drag &amp; drop the file here, or
              </p>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || busy}
              className="mt-3 inline-flex items-center rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {parsing ? 'Reading…' : 'Choose File'}
            </button>
          </div>

          {rows ? (
            <div className="mt-4 rounded-lg border border-zinc-200 p-3 text-sm">
              <p className="text-zinc-700">
                <span className="font-semibold text-zinc-900">{rows.length.toLocaleString()}</span>{' '}
                rows ready to import as{' '}
                <span className="font-semibold text-zinc-900">{typeLabel}</span>.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Matched columns: {mappedFields.map((f) => FIELD_LABELS[f]).join(' - ')}
              </p>
            </div>
          ) : null}

          {rows ? (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Existing {typeLabel} accounts
              </legend>
              <label className="flex items-start gap-2 text-sm text-zinc-700">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="mt-0.5 h-4 w-4 border-zinc-300 text-brand-red focus:ring-brand-red"
                />
                <span>
                  <span className="font-medium">Replace all {typeLabel}</span> - delete every
                  existing {typeLabel} account, then import these. (Other account types are untouched.)
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-700">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                  className="mt-0.5 h-4 w-4 border-zinc-300 text-brand-red focus:ring-brand-red"
                />
                <span>
                  <span className="font-medium">Append</span> - add these on top of the existing
                  accounts.
                </span>
              </label>
            </fieldset>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {busy && progress ? <p className="mt-3 text-sm text-zinc-600">{progress}</p> : null}

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={!rows || rows.length === 0 || busy}
              className="rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
            >
              {busy ? 'Importing…' : mode === 'replace' ? 'Replace & Import' : 'Import'}
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}
