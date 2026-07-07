'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Search,
  Download,
  UploadCloud,
} from 'lucide-react';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABEL,
  type Account,
  type AccountType,
} from '@/lib/account-types';
import { deleteAccounts } from './actions';
import { ExportDialog } from './export-dialog';
import { ImportAccountsDialog } from './import-mailers-dialog';

type ColumnKey =
  | 'account_type'
  | 'status'
  | 'last_name'
  | 'first_name'
  | 'company'
  | 'address_1'
  | 'address_2'
  | 'city'
  | 'state'
  | 'zip'
  | 'email'
  | 'phone'
  | 'subscription_start'
  | 'subscription_end';

const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'account_type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'first_name', label: 'First Name' },
  { key: 'company', label: 'Company' },
  { key: 'address_1', label: 'Address 1' },
  { key: 'address_2', label: 'Address 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'subscription_start', label: 'Sub Start' },
  { key: 'subscription_end', label: 'Sub End' },
];

const PAGE_SIZE = 100;

function searchBlob(a: Account): string {
  return [
    ACCOUNT_TYPE_LABEL[a.account_type],
    a.status,
    a.first_name,
    a.last_name,
    a.company,
    a.address_1,
    a.address_2,
    a.city,
    a.state,
    a.zip,
    a.email,
    a.phone,
    a.acs_keyline,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [sortKey, setSortKey] = useState<ColumnKey>('last_name');
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = accounts.filter((a) => {
      if (typeFilter !== 'all' && a.account_type !== typeFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q && !searchBlob(a).includes(q)) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    rows.sort((a, b) => {
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      if (av === bv) return 0;
      if (av === '') return 1;
      if (bv === '') return -1;
      return String(av).localeCompare(String(bv), 'en', { sensitivity: 'base', numeric: true }) * dir;
    });
    return rows;
  }, [accounts, query, typeFilter, statusFilter, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someSelected = filtered.some((a) => selected.has(a.id));

  function toggleSort(key: ColumnKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((a) => next.delete(a.id));
      else filtered.forEach((a) => next.add(a.id));
      return next;
    });
  }

  function resetFilters() {
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPage(0);
  }

  function handleDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Permanently delete ${ids.length.toLocaleString()} account${ids.length === 1 ? '' : 's'}? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteAccounts(ids);
      if (!res.ok) {
        alert(res.error ?? 'Could not delete.');
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function scroll(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });
  }

  return (
    <div>
      {/* Header: count + actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline text-2xl font-bold text-zinc-900">
            {accounts.length.toLocaleString()} Account{accounts.length === 1 ? '' : 's'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {filtered.length === accounts.length
              ? 'Search, sort, or filter any column. Select rows to permanently delete.'
              : `Showing ${filtered.length.toLocaleString()} of ${accounts.length.toLocaleString()} (filtered).`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {pending ? 'Deleting…' : `Delete ${selected.size.toLocaleString()}`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <UploadCloud className="h-4 w-4" /> Import
          </button>
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" /> Export Label File
          </button>
          <Link
            href="/portal/all/accounts/new"
            className="inline-flex items-center gap-1 rounded bg-brand-red px-3 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark transition-colors"
          >
            <Plus className="h-4 w-4" /> New Account
          </Link>
        </div>
      </div>

      {showExport ? <ExportDialog accounts={accounts} onClose={() => setShowExport(false)} /> : null}
      {showImport ? <ImportAccountsDialog onClose={() => setShowImport(false)} /> : null}

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search all fields…"
            className="w-64 rounded border border-zinc-300 py-2 pl-8 pr-3 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as AccountType | 'all');
            setPage(0);
          }}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          <option value="all">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'active' | 'expired');
            setPage(0);
          }}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
        {(query || typeFilter !== 'all' || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-zinc-500 underline hover:text-zinc-800"
          >
            Clear
          </button>
        )}
        {selected.size > 0 ? (
          <span className="ml-auto text-sm text-zinc-600">
            {selected.size.toLocaleString()} selected
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-2 text-zinc-500 underline hover:text-zinc-800"
            >
              clear
            </button>
          </span>
        ) : null}
      </div>

      {/* Scroll controls */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="mr-1 text-[11px] uppercase tracking-widest text-zinc-400">Scroll</span>
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:text-brand-red"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:text-brand-red"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div ref={scrollRef} className="mt-2 overflow-x-auto rounded border border-zinc-200">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="sticky left-0 z-10 bg-zinc-50 px-2 py-1.5">
                <input
                  type="checkbox"
                  aria-label="Select all filtered"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allFilteredSelected && someSelected;
                  }}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
                />
              </th>
              {COLUMNS.map((col) => {
                const active = col.key === sortKey;
                return (
                  <th key={col.key} className="whitespace-nowrap px-2 py-1.5 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                        active ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {col.label}
                      {active ? (
                        asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : null}
                    </button>
                  </th>
                );
              })}
              <th className="whitespace-nowrap px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Edit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No accounts match.
                </td>
              </tr>
            ) : (
              pageRows.map((a) => {
                const isSel = selected.has(a.id);
                return (
                  <tr key={a.id} className={isSel ? 'bg-brand-red/5' : 'hover:bg-zinc-50'}>
                    <td className={`sticky left-0 z-10 px-2 py-1.5 ${isSel ? 'bg-[#fdf2f4]' : 'bg-white'}`}>
                      <input
                        type="checkbox"
                        aria-label="Select account"
                        checked={isSel}
                        onChange={() => toggleOne(a.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                        {ACCOUNT_TYPE_LABEL[a.account_type]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          a.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium text-zinc-900">{a.last_name || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{a.first_name || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{a.company || '—'}</td>
                    <td className="px-2 py-1.5 text-zinc-700">{a.address_1 || '—'}</td>
                    <td className="px-2 py-1.5 text-zinc-700">{a.address_2 || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{a.city || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">{a.state || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700 tabular-nums">{a.zip || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600">{a.email || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 tabular-nums">{a.phone || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 tabular-nums">{a.subscription_start || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 tabular-nums">{a.subscription_end || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      <Link href={`/portal/all/accounts/${a.id}`} className="text-brand-red hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-zinc-600">
        <span>
          {filtered.length === 0
            ? '0 results'
            : `${(clampedPage * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
                (clampedPage + 1) * PAGE_SIZE,
                filtered.length
              ).toLocaleString()} of ${filtered.length.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tabular-nums">
            Page {clampedPage + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
