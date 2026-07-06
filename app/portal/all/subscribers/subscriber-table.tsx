'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { PaidSubscriberRow } from '@/lib/simplecirc/types';

type SortKind = 'text' | 'date' | 'number';
type ColumnKey =
  | 'lastName'
  | 'firstName'
  | 'street'
  | 'city'
  | 'state'
  | 'email'
  | 'type'
  | 'dateSubscribed'
  | 'lastPaymentDate'
  | 'lastPaymentAmount';

const COLUMNS: Array<{ key: ColumnKey; label: string; kind: SortKind }> = [
  { key: 'lastName', label: 'Last Name', kind: 'text' },
  { key: 'firstName', label: 'First Name', kind: 'text' },
  { key: 'street', label: 'Street', kind: 'text' },
  { key: 'city', label: 'City', kind: 'text' },
  { key: 'state', label: 'State', kind: 'text' },
  { key: 'email', label: 'Email', kind: 'text' },
  { key: 'type', label: 'Type', kind: 'text' },
  { key: 'dateSubscribed', label: 'Date Subscribed', kind: 'date' },
  { key: 'lastPaymentDate', label: 'Last Payment', kind: 'date' },
  { key: 'lastPaymentAmount', label: 'Amount', kind: 'number' },
];

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v; // unparseable → show raw
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtAmount(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function SubscriberTable({ rows }: { rows: PaidSubscriberRow[] }) {
  const [sortKey, setSortKey] = useState<ColumnKey>('lastName');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)!;
    const dir = asc ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];

      // Empty values always sort to the bottom regardless of direction.
      const aEmpty = av == null || av === '';
      const bEmpty = bv == null || bv === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      if (col.kind === 'number') return ((av as number) - (bv as number)) * dir;
      if (col.kind === 'date') {
        return (new Date(av as string).getTime() - new Date(bv as string).getTime()) * dir;
      }
      return String(av).localeCompare(String(bv), 'en', { sensitivity: 'base' }) * dir;
    });
  }, [rows, sortKey, asc]);

  function toggleSort(key: ColumnKey) {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(true);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded border border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400">
        No active paid subscribers found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-right text-[11px] uppercase tracking-widest font-bold text-zinc-500">
              #
            </th>
            {COLUMNS.map((col) => {
              const activeSort = col.key === sortKey;
              return (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-3 py-2 text-left"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold transition-colors ${
                      activeSort ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {col.label}
                    {activeSort ? (
                      asc ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
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
              <td className="sticky left-0 z-10 bg-white px-3 py-2 text-right text-xs text-zinc-400 tabular-nums">
                {i + 1}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">
                {r.lastName || '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.firstName || '—'}</td>
              <td className="px-3 py-2 text-zinc-700">{r.street || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.city || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.state || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{r.email || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {r.type}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600 tabular-nums">
                {fmtDate(r.dateSubscribed)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600 tabular-nums">
                {fmtDate(r.lastPaymentDate)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-700 tabular-nums">
                {fmtAmount(r.lastPaymentAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
