/**
 * Classified-ad extraction — CLIENT ONLY (canvas + pdf.js).
 *
 * Advertisers send a classified as a PDF with the ad artwork sitting in the
 * middle of a mostly-blank page (e.g. Jacuzzi_2x4.pdf). `extractClassifiedAd`
 * rasterizes page 1 with pdf.js at print resolution, scans the pixels for the
 * artwork's bounding box, crops away the blank page margins, and returns a PNG
 * blob ready to upload. Plain images get the same white-border trim.
 *
 * pdf.js worker + the standard-14 fallback fonts are served from
 * /public/pdfjs/ (copied from the pinned pdfjs-dist package).
 */

const WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';
const STANDARD_FONTS = '/pdfjs/standard_fonts/';
/** Rasterization width for a PDF page (px) — print-sharp for a half-column ad. */
const RENDER_W = 1600;
/** A pixel is "content" when any channel is darker than this (0–255). */
const WHITE_THRESHOLD = 246;
/** Padding kept around the detected artwork (px, at render scale). */
const CROP_PAD = 8;

export type ExtractedAd = { blob: Blob; width: number; height: number };

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Find the bounding box of non-white content. Returns null when blank. */
function contentBounds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number } | null {
  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      const a = data[i + 3];
      if (a < 16) continue; // transparent = blank
      if (
        data[i] < WHITE_THRESHOLD ||
        data[i + 1] < WHITE_THRESHOLD ||
        data[i + 2] < WHITE_THRESHOLD
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - CROP_PAD);
  const y = Math.max(0, minY - CROP_PAD);
  return {
    x,
    y,
    w: Math.min(w, maxX + CROP_PAD + 1) - x,
    h: Math.min(h, maxY + CROP_PAD + 1) - y,
  };
}

function cropToPng(source: HTMLCanvasElement): Promise<ExtractedAd> {
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const box = contentBounds(ctx, source.width, source.height) ?? {
    x: 0,
    y: 0,
    w: source.width,
    h: source.height,
  };
  const out = document.createElement('canvas');
  out.width = box.w;
  out.height = box.h;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas is not available in this browser.');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, box.w, box.h);
  octx.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not encode the cropped ad.'));
      resolve({ blob, width: box.w, height: box.h });
    }, 'image/png');
  });
}

async function pdfToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  const doc = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    standardFontDataUrl: STANDARD_FONTS,
  }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: RENDER_W / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    // White base — PDF page background is transparent where nothing paints.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  } finally {
    void doc.destroy();
  }
}

async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the image file.'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PDF or image in → white-trimmed PNG of the ad artwork out. */
export async function extractClassifiedAd(file: File): Promise<ExtractedAd> {
  const canvas = isPdfFile(file) ? await pdfToCanvas(file) : await imageToCanvas(file);
  return cropToPng(canvas);
}
