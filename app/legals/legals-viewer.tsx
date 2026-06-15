'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  const [printing, setPrinting] = useState(false);
  const selected = legals.find((l) => l.id === selectedId) ?? null;

  if (legals.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500">
        No legal notices have been posted yet. Please check back soon.
      </div>
    );
  }

  // Print: fetch the PDF as a same-origin blob, load it into a hidden iframe,
  // and trigger the browser's print dialog (which lets the reader choose
  // which pages to print). Blob avoids cross-origin print restrictions.
  async function handlePrint() {
    if (!selected) return;
    setPrinting(true);
    try {
      const res = await fetch(selected.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Clean up after the dialog has had time to open.
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      };
      document.body.appendChild(iframe);
    } catch {
      // Fallback: open the PDF so the reader can print from the browser viewer.
      window.open(selected.url, '_blank', 'noopener');
    } finally {
      setPrinting(false);
    }
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
          <PdfSpread key={selected.id} url={selected.url} />

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
            >
              {printing ? 'Preparing…' : 'Print'}
            </button>
            <a
              href={`${selected.url}?download=${encodeURIComponent(selected.fileName)}`}
              className="inline-flex items-center px-4 py-2 text-zinc-700 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium uppercase tracking-wide rounded transition-colors"
            >
              Download
            </a>
            <Link
              href={`/legals/request?legalId=${selected.id}&date=${encodeURIComponent(selected.dateLabel)}`}
              className="inline-flex items-center px-4 py-2 text-zinc-700 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium uppercase tracking-wide rounded transition-colors"
            >
              Request Notarized Copy
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
