/**
 * AdCopyView — renders an Ad Database copy file on a newspaper page. Copy is
 * uploaded as an image OR a PDF; an <img> silently renders nothing for a PDF,
 * so PDFs go through an <iframe> (same pattern as ClassifiedPage). Shared by
 * every page renderer that places ad copy so all pages behave identically.
 */

function isPdf(fileName?: string | null, path?: string | null): boolean {
  return (fileName ?? path ?? '').toLowerCase().endsWith('.pdf');
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
    return (
      <iframe
        src={`${src}#toolbar=0&navpanes=0&view=Fit`}
        title={fileName ?? 'Advertisement'}
        scrolling="no"
        style={{ border: 'none', display: 'block', ...style }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={fileName ?? 'Advertisement'} style={{ display: 'block', ...style }} />
  );
}
