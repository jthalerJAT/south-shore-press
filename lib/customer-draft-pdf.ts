'use client';

/**
 * Customer Draft PDF — a letter-size proof the legals desk can hand to a
 * customer before their notice runs:
 *   page 1   the filled-out legal fields (customer, header, copy, run dates,
 *            L# footer line, notary flag); spills onto extra pages if the
 *            copy is unusually long,
 *   last page the real newspaper legal-page preview, scaled to fit.
 * Both pages are captured from live DOM nodes with html2canvas so the draft
 * matches the screen exactly, then assembled with jsPDF and opened as a blob
 * URL the user can view/download from the browser's PDF viewer.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Letter portrait in points, with a 0.5in margin.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const USABLE_W = PAGE_W - MARGIN * 2;
const USABLE_H = PAGE_H - MARGIN * 2;

async function settleRender(): Promise<void> {
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* fonts API unavailable */
  }
  // Double-rAF lets the capture nodes paint — but rAF never fires in a
  // hidden tab, so race it against a timeout or the build hangs the moment
  // the user switches tabs.
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 400);
  });
}

/** Add `canvas` to `doc`, slicing it vertically across as many letter pages
 *  as it needs. `first` suppresses the leading addPage. */
function addCanvasSliced(doc: jsPDF, canvas: HTMLCanvasElement, first: boolean): void {
  const pxPerPt = canvas.width / USABLE_W;
  const sliceHpx = Math.floor(USABLE_H * pxPerPt);
  let y = 0;
  let firstSlice = first;
  while (y < canvas.height) {
    const hPx = Math.min(sliceHpx, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = hPx;
    const ctx = slice.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, hPx, 0, 0, canvas.width, hPx);
    if (!firstSlice) doc.addPage('letter', 'portrait');
    firstSlice = false;
    doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, USABLE_W, hPx / pxPerPt);
    y += hPx;
  }
}

/**
 * html2canvas places flex-centered text by font metrics it computes itself,
 * which sits visibly off-center with the condensed newspaper font. For bars
 * marked data-pdf-vcenter we don't fight it: after capture, the bar's text
 * area is repainted directly on the canvas with textBaseline:'middle', which
 * IS exact. Backgrounds/borders from the capture are kept; only the content
 * box is cleared and the text redrawn, run by run so per-span weights hold.
 */
function repaintVCenteredBars(
  canvas: HTMLCanvasElement,
  rootEl: HTMLElement,
  scale: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rootRect = rootEl.getBoundingClientRect();
  rootEl.querySelectorAll<HTMLElement>('[data-pdf-vcenter]').forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const x = (r.left - rootRect.left + bl) * scale;
    const y = (r.top - rootRect.top + bt) * scale;
    const w = (r.width - bl - br) * scale;
    const h = (r.height - bt - bb) * scale;

    // Clear the content box with the bar's own background.
    const bg = cs.backgroundColor;
    ctx.fillStyle = !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' ? '#ffffff' : bg;
    ctx.fillRect(x, y, w, h);

    // Gather text runs (keeps the footer's mixed span weights).
    type Run = { text: string; font: string };
    const runs: Run[] = [];
    const fontFor = (node: HTMLElement) => {
      const s = getComputedStyle(node);
      return `${s.fontStyle} ${s.fontWeight} ${parseFloat(s.fontSize) * scale}px ${s.fontFamily}`;
    };
    el.childNodes.forEach((n) => {
      const text = n.textContent ?? '';
      if (!text) return;
      runs.push({ text, font: fontFor(n.nodeType === 1 ? (n as HTMLElement) : el) });
    });
    if (runs.length === 0) return;

    const spacing = (parseFloat(cs.letterSpacing) || 0) * scale;
    const canSpace = 'letterSpacing' in ctx;
    if (canSpace) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    let total = 0;
    for (const run of runs) {
      ctx.font = run.font;
      total += ctx.measureText(run.text).width;
    }
    ctx.fillStyle = cs.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x + (w - total) / 2;
    const cy = y + h / 2;
    for (const run of runs) {
      ctx.font = run.font;
      ctx.fillText(run.text, cx, cy);
      cx += ctx.measureText(run.text).width;
    }
    if (canSpace) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  });
}

/**
 * Build the draft from the two capture nodes and open it. Call
 * `window.open('', '_blank')` synchronously in the click handler and pass it
 * as `target` — opening after the async captures would hit popup blockers.
 */
export async function openCustomerDraftPdf(opts: {
  fieldsEl: HTMLElement;
  previewEl: HTMLElement;
  target: Window | null;
}): Promise<void> {
  await settleRender();

  const fieldsCanvas = await html2canvas(opts.fieldsEl, {
    scale: 2,
    backgroundColor: '#ffffff',
  });
  const previewCanvas = await html2canvas(opts.previewEl, {
    scale: 1.5,
    backgroundColor: '#ffffff',
  });
  repaintVCenteredBars(previewCanvas, opts.previewEl, 1.5);

  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

  // Fields sheet: a typical legal fits one page at full width. When it runs
  // modestly over, shrink the whole sheet to fit (like printing at <100%) —
  // readable down to this cap — and only slice onto a second page beyond it.
  const MAX_FIELDS_SHRINK = 1.4;
  const onePageHpx = USABLE_H * (fieldsCanvas.width / USABLE_W);
  if (fieldsCanvas.height > onePageHpx && fieldsCanvas.height <= onePageHpx * MAX_FIELDS_SHRINK) {
    const h = USABLE_H;
    const w = h * (fieldsCanvas.width / fieldsCanvas.height);
    doc.addImage(
      fieldsCanvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      MARGIN + (USABLE_W - w) / 2,
      MARGIN,
      w,
      h
    );
  } else {
    addCanvasSliced(doc, fieldsCanvas, true);
  }

  // Preview page: fit the 1056×1440 newspaper page inside the margins,
  // centered horizontally.
  doc.addPage('letter', 'portrait');
  const ratio = previewCanvas.width / previewCanvas.height;
  let h = USABLE_H;
  let w = h * ratio;
  if (w > USABLE_W) {
    w = USABLE_W;
    h = w / ratio;
  }
  doc.addImage(
    previewCanvas.toDataURL('image/jpeg', 0.92),
    'JPEG',
    MARGIN + (USABLE_W - w) / 2,
    MARGIN,
    w,
    h
  );

  const url = doc.output('bloburl') as unknown as string;
  if (opts.target && !opts.target.closed) {
    opts.target.location.href = url;
  } else {
    // Popup was blocked or closed — fall back to a straight download.
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-draft.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
