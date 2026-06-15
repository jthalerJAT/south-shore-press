'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Document, Page, pdfjs } from 'react-pdf';

// Pin the pdf.js worker to the installed version (served from the CDN).
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Give pdf.js the standard-font + cMap data so PDFs that DON'T embed their
// fonts (common for legal notices generated from Word/legal software) render
// real glyphs instead of empty boxes. Module-level const so the object
// identity is stable across renders (react-pdf re-loads if it changes).
const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

const GAP = 16;
const MAX_PANE = 640;
const PRINT_WIDTH = 1600; // canvas px for print-quality rendering

// Each page is scaled to fit one 8.5×11 sheet (letterboxed + centered).
const PRINT_CSS = `
@media print {
  @page { size: letter portrait; margin: 0.4in; }
  body * { visibility: hidden !important; }
  .legals-print-root, .legals-print-root * { visibility: visible !important; }
  .legals-print-root { position: absolute; left: 0; top: 0; width: 100%; }
  .legals-print-page {
    page-break-after: always;
    display: flex; align-items: center; justify-content: center;
    height: 10.2in;
  }
  .legals-print-page:last-child { page-break-after: auto; }
  .legals-print-page canvas {
    max-width: 100% !important;
    max-height: 10.2in !important;
    width: auto !important;
    height: auto !important;
  }
}`;

/**
 * Side-by-side two-page viewer. Defaults to pages 1 & 2; the arrows advance
 * the spread two pages at a time. Zoom (+/−) plus grab-to-pan let readers
 * magnify the small legal text. Print scales each page to fit letter paper.
 */
export function PdfSpread({
  url,
  fileName,
  dateLabel,
  legalId,
}: {
  url: string;
  fileName: string;
  dateLabel: string;
  legalId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ x: 0, y: 0, left: 0, top: 0, active: false });
  const printedRef = useRef(0);
  const printedTriggeredRef = useRef(false);

  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [spreadStart, setSpreadStart] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // After the browser print dialog closes, tear the print layer down.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, [printing]);

  const isWide = containerWidth >= 720;
  const basePane = Math.min(
    MAX_PANE,
    isWide ? Math.floor((containerWidth - GAP) / 2) : containerWidth || 480
  );
  const paneWidth = Math.round(basePane * zoom);

  const leftPage = spreadStart;
  const rightPage = spreadStart + 1;
  const canPrev = spreadStart > 1;
  const canNext = numPages > 0 && spreadStart + 2 <= numPages;

  function onPanStart(e: React.PointerEvent) {
    const vp = viewportRef.current;
    if (!vp || zoom <= 1) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: vp.scrollLeft,
      top: vp.scrollTop,
      active: true,
    };
    setDragging(true);
    vp.setPointerCapture?.(e.pointerId);
  }
  function onPanMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const vp = viewportRef.current;
    if (!d.active || !vp) return;
    vp.scrollLeft = d.left - (e.clientX - d.x);
    vp.scrollTop = d.top - (e.clientY - d.y);
  }
  function onPanEnd() {
    dragRef.current.active = false;
    setDragging(false);
  }

  function handlePrint() {
    printedRef.current = 0;
    printedTriggeredRef.current = false;
    setPrinting(true);
  }

  function onPrintPageRendered() {
    printedRef.current += 1;
    if (printedRef.current >= numPages && !printedTriggeredRef.current) {
      printedTriggeredRef.current = true;
      // Let the last canvas paint before opening the dialog.
      setTimeout(() => window.print(), 150);
    }
  }

  return (
    <div ref={containerRef} className="mt-5">
      <Document
        file={url}
        options={PDF_OPTIONS}
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
          ref={viewportRef}
          onPointerDown={onPanStart}
          onPointerMove={onPanMove}
          onPointerUp={onPanEnd}
          onPointerLeave={onPanEnd}
          className="overflow-auto rounded border border-zinc-100 bg-zinc-50"
          style={{
            maxHeight: '78vh',
            cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
            touchAction: zoom > 1 ? 'none' : 'auto',
          }}
        >
          <div
            className={
              isWide
                ? 'flex flex-row items-start justify-center gap-4 p-4'
                : 'flex flex-col items-center gap-6 p-4'
            }
            style={{ width: 'max-content', minWidth: '100%' }}
          >
            <Pane page={leftPage} width={paneWidth} />
            {rightPage <= numPages ? (
              <Pane page={rightPage} width={paneWidth} />
            ) : null}
          </div>
        </div>

        {/* Hidden print layer — every page, each scaled to fit letter. */}
        {printing ? (
          <>
            <style>{PRINT_CSS}</style>
            <div className="legals-print-root" aria-hidden>
              {Array.from({ length: numPages }, (_, i) => (
                <div className="legals-print-page" key={i}>
                  <Page
                    pageNumber={i + 1}
                    width={PRINT_WIDTH}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={onPrintPageRendered}
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Document>

      {numPages > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-4">
            <NavBtn label="←" onClick={() => setSpreadStart((s) => Math.max(1, s - 2))} disabled={!canPrev} title="Previous pages" />
            <span className="text-sm text-zinc-500 whitespace-nowrap">
              {rightPage <= numPages ? `Pages ${leftPage}–${rightPage}` : `Page ${leftPage}`} of {numPages}
            </span>
            <NavBtn label="→" onClick={() => setSpreadStart((s) => (s + 2 <= numPages ? s + 2 : s))} disabled={!canNext} title="Next pages" />
          </div>

          <div className="flex items-center gap-2">
            <NavBtn label="−" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5} title="Zoom out" />
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="min-w-[3.5rem] text-sm text-zinc-600 hover:text-zinc-900"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <NavBtn label="+" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} disabled={zoom >= 4} title="Zoom in" />
          </div>
        </div>
      ) : null}

      {zoom > 1 ? (
        <p className="mt-2 text-center text-xs text-zinc-400">Drag to move the page around.</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing || numPages === 0}
          className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
        >
          {printing ? 'Preparing…' : 'Print'}
        </button>
        <a
          href={`${url}?download=${encodeURIComponent(fileName)}`}
          className="inline-flex items-center px-4 py-2 text-zinc-700 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium uppercase tracking-wide rounded transition-colors"
        >
          Download
        </a>
        <Link
          href={`/legals/request?legalId=${legalId}&date=${encodeURIComponent(dateLabel)}`}
          className="inline-flex items-center px-4 py-2 text-zinc-700 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium uppercase tracking-wide rounded transition-colors"
        >
          Request Notarized Copy
        </Link>
      </div>
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}

function Pane({ page, width }: { page: number; width: number }) {
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
