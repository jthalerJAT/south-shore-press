'use client';

/** Admin Legal Database: every customer-uploaded legal, reverse-chron, with
 *  search. Click a row → the read-only filled version of the create screen. */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { CustomerLegal } from '@/lib/queries/customer';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function firstWords(s: string, n = 8): string {
  const words = s.trim().split(/\s+/);
  return words.slice(0, n).join(' ') + (words.length > n ? '…' : '');
}

export function LegalDatabaseList({ legals }: { legals: CustomerLegal[] }) {
  const [searchQ, setSearchQ] = useState('');

  const visible = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return legals;
    return legals.filter((l) =>
      [l.customer_name ?? '', l.header, l.body, l.l_number]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [legals, searchQ]);

  return (
    <div>
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search by customer, L#, or copy…"
          className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="grid grid-cols-[7rem_1fr_1fr_6rem_5rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Date</div>
          <div>Customer</div>
          <div>Copy</div>
          <div>L#</div>
          <div>Notary</div>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">
            {legals.length === 0 ? 'No customer legals yet.' : 'No legals match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/portal/all/legal-database/${l.id}`}
                  className="grid grid-cols-[7rem_1fr_1fr_6rem_5rem] items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-sm text-zinc-500">{fmtDate(l.created_at)}</div>
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {l.customer_name || '—'}
                  </div>
                  <div className="text-sm text-zinc-600 truncate">{firstWords(l.body)}</div>
                  <div className="text-sm font-mono text-zinc-700">{l.l_number}</div>
                  <div className="text-sm font-semibold">
                    {l.notary_required ? (
                      <span className="text-brand-red">Y</span>
                    ) : (
                      <span className="text-zinc-400">N</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
