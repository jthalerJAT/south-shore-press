'use client';

/** Admin Legal Database: every legal — filed customer/staff legals AND the
 *  Legal Notices library the paper places from — in one list sorted by L#,
 *  with search. Click a row to view/edit it. */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

export type LegalRow = {
  /** 'legal' = filed in customer_legals; 'notice' = Legal Notices library. */
  kind: 'legal' | 'notice';
  id: string;
  href: string;
  created_at: string;
  customer: string | null;
  body: string;
  l_number: string | null;
  notary: boolean | null;
};

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

export function LegalDatabaseList({ rows }: { rows: LegalRow[] }) {
  const [searchQ, setSearchQ] = useState('');

  const visible = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((l) =>
      [l.customer ?? '', l.body, l.l_number ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, searchQ]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by customer, L#, or copy…"
            className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <Link
          href="/portal/all/legal-database/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New Legal
        </Link>
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
            {rows.length === 0 ? 'No legals yet.' : 'No legals match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((l) => (
              <li key={`${l.kind}-${l.id}`}>
                <Link
                  href={l.href}
                  className="grid grid-cols-[7rem_1fr_1fr_6rem_5rem] items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-sm text-zinc-500">{fmtDate(l.created_at)}</div>
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {l.customer || (
                      <span className="italic text-zinc-400 font-normal">Library notice</span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-600 truncate">{firstWords(l.body)}</div>
                  <div className="text-sm font-mono text-zinc-700">{l.l_number ?? '—'}</div>
                  <div className="text-sm font-semibold">
                    {l.notary === null ? (
                      <span className="text-zinc-300">—</span>
                    ) : l.notary ? (
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
      <p className="mt-2 text-xs text-zinc-400">
        Sorted by L#, highest first. “Library notice” rows come from the Legal Notices library
        used by the newspaper creator — click one to edit its copy.
      </p>
    </div>
  );
}
