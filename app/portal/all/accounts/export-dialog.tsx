'use client';

import { useMemo, useState } from 'react';
import { X, Download } from 'lucide-react';
import { ACCOUNT_TYPES, type Account, type AccountType } from '@/lib/account-types';
import { toLabelFileCsv } from '@/lib/label-file';

// Physical-paper recipients are pre-checked by default (everyone except the
// digital-only readers, who don't get a paper mailed to them).
const DEFAULT_TYPES = new Set<AccountType>(
  ACCOUNT_TYPES.filter((t) => t.value !== 'digital_only').map((t) => t.value)
);

function todayStamp(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}-${dd}-${yy}`;
}

export function ExportDialog({
  accounts,
  onClose,
}: {
  accounts: Account[];
  onClose: () => void;
}) {
  const [types, setTypes] = useState<Set<AccountType>>(new Set(DEFAULT_TYPES));
  const [activeOnly, setActiveOnly] = useState(true);

  const matching = useMemo(
    () =>
      accounts.filter(
        (a) => types.has(a.account_type) && (!activeOnly || a.status === 'active')
      ),
    [accounts, types, activeOnly]
  );

  function toggleType(t: AccountType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function download() {
    const csv = toLabelFileCsv(matching);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `South Shore Press Labels ${todayStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Overlay onClose={onClose} title="Generate Label File">
      <p className="text-sm text-zinc-600">
        Select which account types to include. The file matches the printer’s label format
        (expiration date, publication, ACS keyline, account ID, name, company, address).
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ACCOUNT_TYPES.map((t) => (
          <label
            key={t.value}
            className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <input
              type="checkbox"
              checked={types.has(t.value)}
              onChange={() => toggleType(t.value)}
              className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
            />
            {t.label}
          </label>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(e) => setActiveOnly(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
        />
        Active accounts only (exclude expired)
      </label>

      <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-4">
        <span className="text-sm text-zinc-600">
          <span className="font-semibold text-zinc-900">{matching.length.toLocaleString()}</span>{' '}
          recipient{matching.length === 1 ? '' : 's'} will be exported
        </span>
        <button
          type="button"
          onClick={download}
          disabled={matching.length === 0}
          className="inline-flex items-center gap-2 rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60 transition-colors"
        >
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>
    </Overlay>
  );
}

/** Simple centered modal overlay (no external dependency). */
export function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-xl font-bold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
