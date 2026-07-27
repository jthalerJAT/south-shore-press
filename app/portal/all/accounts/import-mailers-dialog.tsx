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

type Field =
  | 'first_name'
  | 'last_name'
  | 'company'
  | 'address_1'
  | 'address_2'
  | 'city'
  | 'state'
  | 'zip'
  | 'email'
  | 'phone'
  | 'acs_keyline'
  | 'account_number'
  | 'subscription_start'
  | 'subscription_end'
  | 'last_payment_amount';

type ParsedRow = Partial<Record<Field, string>>;

const FIELD_LABELS: Record<Field, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  company: 'Company',
  address_1: 'Address 1',
  address_2: 'Address 2',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  email: 'Email',
  phone: 'Phone',
  acs_keyline: 'ACS Keyline',
  account_number: 'Account ID',
  subscription_start: 'Start Date',
  subscription_end: 'Expiration Date',
  last_payment_amount: 'Amount Paid',
};

/** Map a spreadsheet header to one of our fields (order matters — address 2
 *  before address 1, etc.). Tolerant of the "Subscriber …" prefixes. */
function matchField(header: string): Field | null {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/address2|addr2|addressline2/.test(h)) return 'address_2';
  if (/address1|addr1|addressline1|streetaddress/.test(h)) return 'address_1';
  if (/address|street/.test(h)) return 'address_1';
  if (/firstname|fname|givenname/.test(h) || h === 'first') return 'first_name';
  if (/lastname|lname|surname|familyname/.test(h) || h === 'last') return 'last_name';
  if (/company|business|organization|organisation/.test(h)) return 'company';
  if (/emailaddress|email/.test(h)) return 'email';
  if (/phone|tel|mobile|cell/.test(h)) return 'phone';
  if (/city|town/.test(h)) return 'city';
  if (/state|province|region/.test(h)) return 'state';
  if (/zip|postal/.test(h)) return 'zip';
  if (/acs|keyline/.test(h)) return 'acs_keyline';
  if (/accountid|accountnumber|acct/.test(h) || h === 'account') return 'account_number';
  if (/amountpaid|paymentamount|amount/.test(h)) return 'last_payment_amount';
  if (/paymentstart|startdate|datestarted|substart|subscriptionstart/.test(h)) return 'subscription_start';
  if (/expir|paymentexpire|enddate|expiredate|subend|subscriptionend/.test(h)) return 'subscription_end';
  return null;
}

const CHUNK = 1000;

/** Shrink a sheet's declared range (`!ref`) to the cells that actually hold
 *  values. Excel routinely declares ranges out to column XFD / row 1048576
 *  (stray formatting does it), and `sheet_to_json` materializes EVERY declared
 *  cell — a real mailer list declared as B2:XFD5988 is ~98 million cells and
 *  locks the browser. The sheet object is sparse, so scanning its real keys is
 *  cheap. */
function trimSheetRange(XLSX: typeof import('xlsx'), sheet: import('xlsx').WorkSheet): void {
  if (!sheet['!ref']) return;
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -1;
  let maxC = -1;
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const cell = sheet[key];
    if (cell == null) continue;
    // Blank = no usable VALUE. Formulas don't matter — the import consumes
    // computed values only. The real-world trigger was a single cell
    // XFD984="" (a formula evaluating to empty) declaring the full
    // 16,384-column width.
    if (cell.v == null || (typeof cell.v === 'string' && cell.v.trim() === '')) continue;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  if (maxR < 0) return; // truly empty — leave as-is; caller reports "no data"
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
}

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

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setDone(null);
    setRows(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      trimSheetRange(XLSX, sheet);
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });
      if (json.length === 0) {
        setError('That file has no data rows.');
        setParsing(false);
        return;
      }

      const headerMap = new Map<string, Field>();
      for (const key of Object.keys(json[0])) {
        const f = matchField(key);
        if (f && !Array.from(headerMap.values()).includes(f)) headerMap.set(key, f);
      }
      if (headerMap.size === 0) {
        setError('Could not recognize any columns (name, address, city, etc.). Check the header row.');
        setParsing(false);
        return;
      }

      const parsed: ParsedRow[] = [];
      for (const r of json) {
        const row: ParsedRow = {};
        for (const [key, field] of headerMap) {
          const v = r[key];
          row[field] = v == null ? '' : String(v).trim();
        }
        if (row.first_name || row.last_name || row.company || row.address_1) parsed.push(row);
      }

      setRows(parsed);
      setMappedFields(Array.from(headerMap.values()));
      setParsing(false);
    } catch (e) {
      console.error('[import parse]', e);
      setError('Could not read that file. Use an .xlsx, .xls, or .csv export.');
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
            are matched by name — first/last name, company, address 1/2, city, state, zip, email,
            phone, ACS keyline, account ID, start/expiration dates.
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
                Matched columns: {mappedFields.map((f) => FIELD_LABELS[f]).join(' · ')}
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
                  <span className="font-medium">Replace all {typeLabel}</span> — delete every
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
                  <span className="font-medium">Append</span> — add these on top of the existing
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
