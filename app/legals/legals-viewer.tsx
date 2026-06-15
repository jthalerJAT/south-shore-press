'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { LegalViewItem } from './page';

// react-pdf / pdf.js is browser-only — load the spread with ssr:false.
const PdfSpread = dynamic(() => import('./pdf-spread').then((m) => m.PdfSpread), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-zinc-500 py-12 text-center">Loading viewer…</p>
  ),
});

export function LegalsViewer({ legals }: { legals: LegalViewItem[] }) {
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = legals.find((l) => l.id === selectedId) ?? null;

  if (legals.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
        No legal notices have been posted yet. Please check back soon.
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="max-w-md">
        <label
          htmlFor="legal-date"
          className="block text-sm font-medium text-zinc-700"
        >
          Select a date
        </label>
        <select
          id="legal-date"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          <option value="">Choose a date…</option>
          {legals.map((l) => (
            <option key={l.id} value={l.id}>
              {l.dateLabel}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="mt-8">
          <h2 className="font-headline text-xl sm:text-2xl font-bold text-zinc-900">
            Legal Pages from the Newspaper Dated {selected.dateLabel}
          </h2>

          {/* key forces a fresh load when the selected file changes */}
          <PdfSpread
            key={selected.id}
            url={selected.url}
            fileName={selected.fileName}
            dateLabel={selected.dateLabel}
            legalId={selected.id}
          />
        </div>
      ) : null}
    </div>
  );
}
