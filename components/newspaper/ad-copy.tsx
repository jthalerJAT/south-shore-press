'use client';

/**
 * AdCopyView — renders an Ad Database copy file on a newspaper page. Copy is
 * uploaded as an image OR a PDF. Images render directly. PDFs are RASTERIZED
 * client-side (pdf.js, page 1) into an <img> so they obey the caller's sizing
 * exactly like image ads — an <iframe> PDF viewer letterboxes the page on its
 * own dark background and ignores objectFit, so a full-page ad never filled
 * the sheet. Falls back to the old iframe if rasterization fails. Shared by
 * every page renderer that places ad copy so all pages behave identically.
 */
import { useEffect, useState } from 'react';

const WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';
const STANDARD_FONTS = '/pdfjs/standard_fonts/';
/** Rasterization width (px) — print-sharp for a full-page creative. */
const RENDER_W = 2000;

function isPdf(fileName?: string | null, path?: string | null): boolean {
  return (fileName ?? path ?? '').toLowerCase().endsWith('.pdf');
}

function PdfAdView({
  src,
  fileName,
  style,
}: {
  src: string;
  fileName?: string | null;
  style?: React.CSSProperties;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        const doc = await pdfjs.getDocument({ url: src, standardFontDataUrl: STANDARD_FONTS }).promise;
        try {
          const page = await doc.getPage(1);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: RENDER_W / base.width });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('no canvas');
          ctx.fillStyle = '#fff'; // PDF background is transparent where unpainted
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
          if (!blob) throw new Error('encode failed');
          objUrl = URL.createObjectURL(blob);
          if (alive) setImgUrl(objUrl);
        } finally {
          void doc.destroy();
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [src]);

  if (failed) {
    // Old behavior — better a letterboxed viewer than nothing.
    return (
      <iframe
        src={`${src}#toolbar=0&navpanes=0&view=Fit`}
        title={fileName ?? 'Advertisement'}
        scrolling="no"
        style={{ border: 'none', display: 'block', ...style }}
      />
    );
  }
  if (!imgUrl) {
    // Rasterizing — hold the slot at the caller's size, plain white.
    return <div style={{ background: '#fff', ...style }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imgUrl} alt={fileName ?? 'Advertisement'} style={{ display: 'block', ...style }} />
  );
}

export function AdCopyView({
  src,
  fileName,
  storagePath,
  style,
}: {
  src: string;
  fileName?: string | null;
  /** Fallback for the PDF check when no file name was stored. */
  storagePath?: string | null;
  /** Sizing comes from the caller (width/height/flex/objectFit). */
  style?: React.CSSProperties;
}) {
  if (isPdf(fileName, storagePath)) {
    return <PdfAdView src={src} fileName={fileName} style={style} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={fileName ?? 'Advertisement'} style={{ display: 'block', ...style }} />
  );
}
