'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaidSubscriberRow } from '@/lib/simplecirc/types';

type SortKind = 'text' | 'date' | 'number';
type ColumnKey = keyof Omit<PaidSubscriberRow, 'key'>;

const COLUMNS: Array<{ key: ColumnKey; label: string; kind: SortKind; align?: 'right' }> = [
  { key: 'accountId', label: 'Account ID', kind: 'text' },
  { key: 'lastName', label: 'Last Name', kind: 'text' },
  { key: 'firstName', label: 'First Name', kind: 'text' },
  { key: 'address1', label: 'Address 1', kind: 'text' },
  { key: 'city', label: 'City', kind: 'text' },
  { key: 'state', label: 'State', kind: 'text' },
  { key: 'email', label: 'Email', kind: 'text' },
  { key: 'typeName', label: 'Type', kind: 'text' },
  { key: 'amountPaid', label: 'Amount Paid', kind: 'number', align: 'right' },
  { key: 'startDate', label: 'Start Date', kind: 'date' },
  { key: 'expireDate', label: 'Expire Date', kind: 'date' },
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
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });
  }

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
        No paid subscribers found.
      </div>
    );
  }

  return (
    <div>
      <ScrollControls onScroll={scroll} />
      <div ref={scrollRef} className="overflow-x-auto rounded border border-zinc-200">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="sticky left-0 z-10 bg-zinc-50 px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                #
              </th>
              {COLUMNS.map((col) => {
                const activeSort = col.key === sortKey;
                return (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-2 py-1.5 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                        activeSort ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {col.label}
                      {activeSort ? (
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
              <tr key={r.key} className="hover:bg-zinc-50">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-right text-[11px] text-zinc-400 tabular-nums">
                  {i + 1}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500 tabular-nums">{r.accountId || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 font-medium text-zinc-900">{r.lastName || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{r.firstName || '—'}</td>
                <td className="px-2 py-1.5 text-zinc-700">{r.address1 || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{r.city || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{r.state || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600">{r.email || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                    {r.typeName || '—'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right text-zinc-700 tabular-nums">
                  {fmtAmount(r.amountPaid)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 tabular-nums">{fmtDate(r.startDate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 tabular-nums">{fmtDate(r.expireDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScrollControls onScroll={scroll} />
    </div>
  );
}

/** Left / right buttons that scroll the table horizontally. Rendered above and
 *  below the table so a wide table can be panned from either end. */
function ScrollControls({ onScroll }: { onScroll: (dir: -1 | 1) => void }) {
  return (
    <div className="flex items-center justify-end gap-2 py-1.5">
      <span className="mr-1 text-[11px] uppercase tracking-widest text-zinc-400">Scroll</span>
      <button
        type="button"
        onClick={() => onScroll(-1)}
        aria-label="Scroll table left"
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:text-brand-red transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onScroll(1)}
        aria-label="Scroll table right"
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:text-brand-red transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
