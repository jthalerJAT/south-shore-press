'use client';

/**
 * AdCopyPicker — the shared two-step "+ Insert Ad" control (Ad Database v2).
 * Step 1: a dropdown of just the client (account) names, alphabetical.
 * Step 2: that client's copy files, newest first, with size + date beside each.
 * Used by every place the newspaper creator places an ad from the database.
 */
import { useMemo, useState } from 'react';
import { AD_SIZES } from '@/lib/newspaper-templates';
import type { Ad } from '@/lib/queries/ads';

export function fmtAdDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function adSizeLabel(size: string | null): string {
  if (!size) return '—';
  return AD_SIZES.find((s) => s.value === size)?.label ?? size;
}

export function AdCopyPicker({
  ads,
  onPick,
  disabled,
  label = 'Place an ad from the Ad Database',
}: {
  /** Flat copy-file rows from getAds() (one per copy, client fields joined). */
  ads: Ad[];
  onPick: (ad: Ad) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [clientName, setClientName] = useState('');

  const clients = useMemo(() => {
    const names = new Set<string>();
    for (const a of ads) names.add(a.business_name);
    return Array.from(names).sort((x, y) =>
      x.localeCompare(y, 'en', { sensitivity: 'base' })
    );
  }, [ads]);

  const copies = useMemo(
    () =>
      ads
        .filter((a) => a.business_name === clientName)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [ads, clientName]
  );

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      <select
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        disabled={disabled}
        className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none disabled:opacity-60"
      >
        <option value="">Choose a client…</option>
        {clients.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      {clientName ? (
        <ul className="mt-2 border border-zinc-200 rounded divide-y divide-zinc-100 bg-white max-h-64 overflow-y-auto">
          {copies.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-zinc-400">
              No copy on file for {clientName} — upload it in the Ad Database.
            </li>
          ) : (
            copies.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(a)}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-50 disabled:opacity-60 transition-colors"
                >
                  <span className="block text-[13px] font-medium text-zinc-900 truncate">
                    {a.copy_file_name || 'Copy file'}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">
                    {adSizeLabel(a.copy_size)} · {fmtAdDate(a.created_at)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
