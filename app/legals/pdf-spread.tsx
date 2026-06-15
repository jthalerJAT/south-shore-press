'use client';

import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Pin the pdf.js worker to the installed version (served from the CDN).
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const GAP = 16;
const MAX_PANE = 640;

/**
 * Side-by-side two-page viewer. Defaults to pages 1 & 2; the arrows advance
 * the spread two pages at a time, with the page number shown under each pane.
 * On narrow screens the two pages stack vertically.
 */
export function PdfSpread({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [spreadStart, setSpreadStart] = useState(1); // left page (1-based)

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isWide = containerWidth >= 720;
  const paneWidth = Math.min(
    MAX_PANE,
    isWide ? Math.floor((containerWidth - GAP) / 2) : containerWidth || 480
  );

  const leftPage = spreadStart;
  const rightPage = spreadStart + 1;
  const canPrev = spreadStart > 1;
  const canNext = numPages > 0 && spreadStart + 2 <= numPages;

  return (
    <div ref={containerRef} className="mt-5">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setSpreadStart(1);
        }}
        loading={
          <p className="text-sm text-zinc-500 py-12 text-center">Loading document…</p>
        }
        error={
          <p className="text-sm text-red-600 py-12 text-center">
            Could not load this PDF. Try downloading it instead.
          </p>
        }
      >
        <div
          className={
            isWide
              ? 'flex flex-row items-start justify-center gap-4'
              : 'flex flex-col items-center gap-6'
          }
        >
          <Pane url={url} page={leftPage} width={paneWidth} />
          {rightPage <= numPages ? (
            <Pane url={url} page={rightPage} width={paneWidth} />
          ) : null}
        </div>
      </Document>

      {numPages > 0 ? (
        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => setSpreadStart((s) => Math.max(1, s - 2))}
            disabled={!canPrev}
            aria-label="Previous pages"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-zinc-500">
            {rightPage <= numPages
              ? `Pages ${leftPage}–${rightPage}`
              : `Page ${leftPage}`}{' '}
            of {numPages}
          </span>
          <button
            type="button"
            onClick={() => setSpreadStart((s) => (s + 2 <= numPages ? s + 2 : s))}
            disabled={!canNext}
            aria-label="Next pages"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Pane({ url, page, width }: { url: string; page: number; width: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="border border-zinc-200 shadow-sm bg-white">
        <Page
          pageNumber={page}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={
            <div
              style={{ width, height: width * 1.4 }}
              className="flex items-center justify-center text-xs text-zinc-400"
            >
              Loading page {page}…
            </div>
          }
        />
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-600">Page {page}</div>
    </div>
  );
}
