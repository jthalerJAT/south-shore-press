'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { adFilePublicUrl } from '@/lib/ad-files';
import type { AdRun } from '@/lib/queries/ads';
import { addAdRun, updateAdRun, deleteAdRun, type AdRunInput } from './actions';
import { uploadAdFile } from './upload-client';

const PAGE_SIZES = ['Full Page', 'Half Page', 'Quarter Page', 'Eighth Page', 'Business Card', 'Other'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
function fmtMoney(n: number | null): string {
  return n == null ? '—' : `$${Number(n).toFixed(2)}`;
}
const CHECK = '✅';
const CROSS = '❌';

export function AdRuns({
  adId,
  runs,
  adCopyUrl,
  adCopyName,
}: {
  adId: string;
  runs: AdRun[];
  adCopyUrl: string | null;
  adCopyName: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline text-lg font-bold text-zinc-900">Scheduled Runs</h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> Add New Ad Run
        </button>
      </div>

      {error ? (
        <div role="alert" className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      {adding ? (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <RunForm
            submitLabel="Add Ad Run"
            submitting={isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) => run(() => addAdRun(adId, input), () => setAdding(false))}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded border border-zinc-200">
        <div className="grid grid-cols-[8rem_4rem_6rem_1fr_5rem_5rem] items-center gap-2 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Date Started</div>
          <div>Weeks</div>
          <div>Price/Wk</div>
          <div>Page Size</div>
          <div className="text-center">Invoiced</div>
          <div className="text-center">Paid</div>
        </div>
        {runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-400">No runs scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {runs.map((r) => (
              <RunRow key={r.id} run={r} adId={adId} adCopyUrl={adCopyUrl} adCopyName={adCopyName} onRun={run} pending={isPending} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RunRow({
  run,
  adId,
  adCopyUrl,
  adCopyName,
  onRun,
  pending,
}: {
  run: AdRun;
  adId: string;
  adCopyUrl: string | null;
  adCopyName: string | null;
  onRun: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <li>
      <div
        onClick={() => setExpanded((v) => !v)}
        className="grid grid-cols-[8rem_4rem_6rem_1fr_5rem_5rem] items-center gap-2 px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors"
      >
        <div className="text-sm text-zinc-700">{fmtDate(run.date_started)}</div>
        <div className="text-sm text-zinc-700">{run.num_weeks ?? '—'}</div>
        <div className="text-sm text-zinc-700">{fmtMoney(run.price_per_week)}</div>
        <div className="text-sm text-zinc-700 truncate">{run.page_size || '—'}</div>
        <div className="text-center">{run.invoiced ? CHECK : CROSS}</div>
        <div className="text-center">{run.paid ? CHECK : CROSS}</div>
      </div>

      {expanded ? (
        <div className="px-4 pb-4 bg-zinc-50/60 border-t border-zinc-100">
          <div className="flex items-start justify-between gap-3 pt-3">
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-500">Ad Copy</div>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-semibold text-brand-red hover:underline"
              >
                Edit Ad Run
              </button>
            ) : null}
          </div>

          {adCopyUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={adCopyUrl} alt={adCopyName ?? 'Ad copy'} className="mt-2 max-h-56 border border-zinc-200 bg-white object-contain" />
          ) : (
            <p className="mt-2 text-sm text-zinc-400 italic">No copy uploaded for this advertiser.</p>
          )}

          {editing ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
              <RunForm
                initial={run}
                showStatus
                submitLabel="Save Ad Run"
                submitting={pending}
                onCancel={() => setEditing(false)}
                onSubmit={(input) => onRun(() => updateAdRun(run.id, adId, input), () => setEditing(false))}
              />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-4 text-sm text-zinc-600">
              {run.insert_order_path ? (
                <button
                  type="button"
                  onClick={() => window.open(adFilePublicUrl(run.insert_order_path!), '_blank')}
                  className="text-brand-red hover:underline"
                >
                  {run.insert_order_file_name || 'View insert order'}
                </button>
              ) : (
                <span className="text-zinc-400 italic">No insert order</span>
              )}
              <span className="ml-auto" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this ad run?')) onRun(() => deleteAdRun(run.id, adId));
                }}
                className="inline-flex items-center gap-1 text-red-600 hover:underline"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function RunForm({
  initial,
  showStatus,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: AdRun;
  showStatus?: boolean;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: AdRunInput) => void;
  onCancel: () => void;
}) {
  const [dateStarted, setDateStarted] = useState(initial?.date_started ?? '');
  const [numWeeks, setNumWeeks] = useState(initial?.num_weeks != null ? String(initial.num_weeks) : '');
  const [price, setPrice] = useState(initial?.price_per_week != null ? String(initial.price_per_week) : '');
  const [pageSize, setPageSize] = useState(initial?.page_size ?? 'Quarter Page');
  const [insertPath, setInsertPath] = useState(initial?.insert_order_path ?? '');
  const [insertName, setInsertName] = useState(initial?.insert_order_file_name ?? '');
  const [invoiced, setInvoiced] = useState(Boolean(initial?.invoiced));
  const [paid, setPaid] = useState(Boolean(initial?.paid));
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    const res = await uploadAdFile('insert', file);
    setUploading(false);
    if (!res.ok) {
      setUploadErr(res.error ?? 'Upload failed.');
      return;
    }
    setInsertPath(res.path!);
    setInsertName(res.fileName!);
  }

  function submit() {
    onSubmit({
      date_started: dateStarted || null,
      num_weeks: numWeeks ? Number(numWeeks) : null,
      price_per_week: price ? Number(price) : null,
      page_size: pageSize,
      insert_order_path: insertPath || null,
      insert_order_file_name: insertName || null,
      invoiced,
      paid,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block font-medium text-zinc-700 mb-1">Date Started</span>
          <input type="date" value={dateStarted} onChange={(e) => setDateStarted(e.target.value)} className="block w-full rounded border border-zinc-300 px-3 py-2 focus:border-brand-red focus:outline-none" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-zinc-700 mb-1">Number of Weeks</span>
          <input type="number" min="0" value={numWeeks} onChange={(e) => setNumWeeks(e.target.value)} className="block w-full rounded border border-zinc-300 px-3 py-2 focus:border-brand-red focus:outline-none" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-zinc-700 mb-1">Price Per Week</span>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="block w-full rounded border border-zinc-300 px-3 py-2 focus:border-brand-red focus:outline-none" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-zinc-700 mb-1">Page Size</span>
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="block w-full rounded border border-zinc-300 px-3 py-2 focus:border-brand-red focus:outline-none">
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-zinc-700 mb-1">Insert Order</span>
        <div className="flex items-center gap-2">
          {insertName ? (
            <span className="text-sm text-zinc-700">
              {insertName}{' '}
              <button type="button" onClick={() => { setInsertPath(''); setInsertName(''); }} className="ml-1 text-red-600 hover:underline">
                remove
              </button>
            </span>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          {!insertName ? (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 text-sm font-medium text-zinc-700 rounded">
              {uploading ? 'Uploading…' : '+ Upload Insert Order'}
            </button>
          ) : null}
        </div>
        {uploadErr ? <p className="mt-1 text-xs text-red-600">{uploadErr}</p> : null}
      </div>

      {showStatus ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInvoiced((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border ${invoiced ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-300 text-zinc-600'}`}
          >
            Invoiced {invoiced ? CHECK : CROSS}
          </button>
          <button
            type="button"
            onClick={() => setPaid((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border ${paid ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-300 text-zinc-600'}`}
          >
            Paid {paid ? CHECK : CROSS}
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || uploading}
          className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-zinc-500 hover:text-zinc-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
