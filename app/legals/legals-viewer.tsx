'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LegalViewItem } from './page';

/**
 * Legals viewer. Renders each PDF in the browser's NATIVE PDF viewer (an
 * <iframe>) — the same engine Chrome/Edge/Safari use to open a PDF — which
 * renders every font correctly and provides built-in zoom / scroll / search.
 * We tried react-pdf (pdf.js) first, but it choked on the non-embedded fonts
 * common in third-party legal notices (text rendered as empty boxes).
 */
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

  // Print via a same-origin blob so the browser's print dialog (with its
  // page-selection + fit-to-paper) handles it, regardless of cross-origin.
  async function handlePrint() {
    if (!selected) return;
    setPrinting(true);
    try {
      const res = await fetch(selected.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      iframe.src = blobUrl;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      };
      document.body.appendChild(iframe);
    } catch {
      window.open(selected.url, '_blank', 'noopener');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <p className="mb-6 text-base leading-relaxed text-zinc-700">
        Digital versions of our legal section can be found below. To receive a copy of your legal,
        either via email or a physical copy via the US postal service (including a notarized copy, if
        necessary), please email us at{' '}
        <a
          href="mailto:legals@southshorepress.com"
          className="font-medium text-brand-red hover:underline"
        >
          legals@southshorepress.com
        </a>
        .
      </p>

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

          <iframe
            key={selected.id}
            src={`${selected.url}#view=FitH`}
            title={`Legal notices dated ${selected.dateLabel}`}
            className="mt-5 w-full rounded border border-zinc-200 bg-zinc-50"
            style={{ height: '82vh' }}
          />

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

          <p className="mt-3 text-xs text-zinc-400">
            Use the PDF viewer&apos;s own controls to zoom, scroll, or search the
            notices.
          </p>
        </div>
      ) : null}
    </div>
  );
}
