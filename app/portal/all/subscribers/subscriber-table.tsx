'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { ACCOUNT_TYPE_LABEL, type Account } from '@/lib/account-types';
import { formatDateDMY } from '@/lib/format';

type SortKind = 'text' | 'date';
type ColumnKey =
  | 'last_name'
  | 'first_name'
  | 'address_1'
  | 'city'
  | 'state'
  | 'email'
  | 'account_type'
  | 'subscription_start'
  | 'subscription_end';

const COLUMNS: Array<{ key: ColumnKey; label: string; kind: SortKind }> = [
  { key: 'last_name', label: 'Last Name', kind: 'text' },
  { key: 'first_name', label: 'First Name', kind: 'text' },
  { key: 'address_1', label: 'Street', kind: 'text' },
  { key: 'city', label: 'City', kind: 'text' },
  { key: 'state', label: 'State', kind: 'text' },
  { key: 'email', label: 'Email', kind: 'text' },
  { key: 'account_type', label: 'Type', kind: 'text' },
  { key: 'subscription_start', label: 'Started', kind: 'date' },
  { key: 'subscription_end', label: 'Renews / Expires', kind: 'date' },
];

function fmtDate(v: string | null): string {
  return formatDateDMY(v) || '—';
}

export function SubscriberTable({ rows }: { rows: Account[] }) {
  const [sortKey, setSortKey] = useState<ColumnKey>('last_name');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)!;
    const dir = asc ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const aEmpty = av == null || av === '';
      const bEmpty = bv == null || bv === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      if (col.kind === 'date') {
        return (new Date(av as string).getTime() - new Date(bv as string).getTime()) * dir;
      }
      return String(av).localeCompare(String(bv), 'en', { sensitivity: 'base' }) * dir;
    });
  }, [rows, sortKey, asc]);

  function toggleSort(key: ColumnKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded border border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400">
        No active paid subscribers yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-200">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-widest font-bold text-zinc-500">
              #
            </th>
            {COLUMNS.map((col) => {
              const active = col.key === sortKey;
              return (
                <th key={col.key} className="whitespace-nowrap px-3 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold transition-colors ${
                      active ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {col.label}
                    {active ? (
                      asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((r, i) => (
            <tr key={r.id} className="hover:bg-zinc-50">
              <td className="px-3 py-2 text-right text-xs text-zinc-400 tabular-nums">{i + 1}</td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">{r.last_name || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.first_name || '—'}</td>
              <td className="px-3 py-2 text-zinc-700">{r.address_1 || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.city || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.state || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{r.email || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {ACCOUNT_TYPE_LABEL[r.account_type]}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600 tabular-nums">{fmtDate(r.subscription_start)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600 tabular-nums">{fmtDate(r.subscription_end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
