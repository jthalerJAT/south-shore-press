'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ReaderRow } from '@/lib/queries/profiles';

/**
 * Display-only Readers table, rendered below the editorial credentials
 * table on /portal/all/credentials. Search filters by name / email /
 * city. Sorting is by signup date desc (newest first) — no column-level
 * sorting yet since the column count is high and a basic search covers
 * the common admin workflow.
 */
export function ReadersTable({ readers }: { readers: ReaderRow[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return readers;
    return readers.filter((r) => {
      const haystack = [
        r.display_name,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.state,
        r.zip_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [readers, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-headline text-xl font-bold text-zinc-900">
            Readers
          </h2>
          <p className="text-sm text-zinc-500">
            {readers.length} reader{readers.length === 1 ? '' : 's'}
            {filtered.length !== readers.length
              ? ` (${filtered.length} shown)`
              : null}
            . Display-only — readers manage their own profile from /account.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search name, email, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Address</Th>
              <Th>Card</Th>
              <Th>Subscription</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No readers match this search.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <Td>
                    {[r.first_name, r.last_name].filter(Boolean).join(' ') ||
                      r.display_name ||
                      '—'}
                  </Td>
                  <Td>{r.email}</Td>
                  <Td>{r.phone ?? '—'}</Td>
                  <Td>
                    {r.street_address ? (
                      <>
                        {r.street_address}
                        {r.city || r.state || r.zip_code ? (
                          <div className="text-xs text-zinc-500">
                            {[r.city, r.state, r.zip_code].filter(Boolean).join(', ')}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{r.has_payment_method ? 'On file' : '—'}</Td>
                  <Td>
                    {r.subscription_status ? (
                      <>
                        <span className="capitalize">{r.subscription_status}</span>
                        {r.subscription_tier ? (
                          <div className="text-xs text-zinc-500">{r.subscription_tier}</div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-zinc-500">Free</span>
                    )}
                  </Td>
                  <Td>
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-zinc-800">{children}</td>;
}
