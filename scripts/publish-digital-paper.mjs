// Publish the just-exported issue to the portal's Digital Paper archive.
// Runs in the export-issue workflow right after the press export:
//   1. compress out/issue-rgb.pdf → out/issue-web.pdf (Ghostscript /ebook —
//      screen-resolution images, text stays selectable, ~10-20MB)
//   2. read the issue date off page 1 (gs txtwrite) + count pages
//   3. mint a signed Storage upload via /api/ingest/digital-paper, PUT the
//      file straight to Supabase (Vercel's body cap doesn't allow a proxy
//      upload), then record the row (replaces the date's previous file)
//
// Skipped for partial exports (PAGES set) — only full issues are archived.
// Env: GS (ghostscript binary), PRINT_API_TOKEN / INDESIGN_API_TOKEN,
//      PRINT_BASE (defaults to the production alias).

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, existsSync } from 'node:fs';

const BASE = (process.env.PRINT_BASE || 'https://south-shore-press.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.PRINT_API_TOKEN || process.env.INDESIGN_API_TOKEN;
const GS = process.env.GS || 'gs';
const SRC = 'out/issue-rgb.pdf';
const WEB = 'out/issue-web.pdf';

if (process.env.PAGES && process.env.PAGES.trim() !== '') {
  console.log('PAGES set (partial export) — skipping Digital Paper publish.');
  process.exit(0);
}
if (!TOKEN) throw new Error('PRINT_API_TOKEN / INDESIGN_API_TOKEN not set.');
if (!existsSync(SRC)) throw new Error(`${SRC} not found — run the export first.`);

// 1) Compress for screens/email. /ebook downsamples images to 150dpi; pull
//    color/gray down to 100dpi to keep 40-48 page issues email-friendly.
console.log('Compressing web edition …');
execFileSync(GS, [
  '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook',
  '-dColorImageResolution=100', '-dGrayImageResolution=100', '-dMonoImageResolution=300',
  '-dNOPAUSE', '-dBATCH', '-dQUIET', `-sOutputFile=${WEB}`, SRC,
], { stdio: 'inherit' });
const sizeBytes = statSync(WEB).size;
console.log(`issue-web.pdf: ${(sizeBytes / 1e6).toFixed(1)} MB`);

// 2) Issue date from page 1 + page count.
const p1txt = execFileSync(GS, [
  '-sDEVICE=txtwrite', '-dFirstPage=1', '-dLastPage=1',
  '-dNOPAUSE', '-dBATCH', '-dQUIET', '-sOutputFile=-', SRC,
]).toString('utf8');
const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const m = p1txt.match(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})\\w*,?\\s*(\\d{4})`, 'i'));
if (!m) throw new Error('Could not find the issue date on page 1.');
const issueDate = `${m[3]}-${String(MONTHS.indexOf(m[1].toUpperCase()) + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
const pageCount = Number(
  execFileSync(GS, ['-q', '-dNODISPLAY', '-dNOSAFER', '-c', `(${SRC}) (r) file runpdfbegin pdfpagecount = quit`])
    .toString('utf8').trim()
);
console.log(`Issue date ${issueDate}, ${pageCount} pages.`);

// 3) Sign → PUT → record.
async function api(payload, endpoint = 'digital-paper') {
  const r = await fetch(`${BASE}/api/ingest/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ssp-print-token': TOKEN },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(`${payload.action} failed (${r.status}): ${data.error ?? 'unknown'}`);
  return data;
}

const signed = await api({ action: 'sign' });
console.log('Uploading to Storage …');
const put = await fetch(signed.signedUrl, {
  method: 'PUT',
  headers: { 'content-type': 'application/pdf' },
  body: readFileSync(WEB),
});
if (!put.ok) throw new Error(`Storage upload failed (${put.status}): ${(await put.text()).slice(0, 200)}`);

await api({
  action: 'record',
  issue_date: issueDate,
  storage_path: signed.path,
  file_name: `SSP ${issueDate}.pdf`,
  page_count: pageCount,
  file_size_bytes: sizeBytes,
});
console.log(`Digital Paper published: ${issueDate} (${pageCount} pages, ${(sizeBytes / 1e6).toFixed(1)} MB).`);

// ── Legals section → the public Legals library ──────────────────────────────
// Detect the legal-notices pages: text pages carrying the LEGAL NOTICES
// banner near the top, EXTENDED across adjacent image-only pages (uploaded
// court documents rasterized into the paper carry no text beyond the running
// header — the 2026-08-26 issue's 8 extra pages taught us this).
try {
  const mupdf = await import('mupdf');
  const { readFileSync: rf } = await import('node:fs');
  const doc = mupdf.PDFDocument.openDocument(rf(SRC), 'application/pdf');
  const n = doc.countPages();
  const texts = [];
  for (let i = 0; i < n; i++) {
    texts.push(doc.loadPage(i).toStructuredText('preserve-whitespace').asText());
  }
  const isCore = (t) =>
    t.toUpperCase().slice(0, 600).includes('LEGAL NOTICES') &&
    (t.toUpperCase().match(/NOTICE/g) ?? []).length > 3;
  const isImageOnly = (t) => t.replace(/\s+/g, ' ').trim().length <= 250;
  const core = texts.map((t, i) => (isCore(t) ? i : -1)).filter((i) => i >= 0);
  if (core.length === 0) {
    console.log('No legal-notices pages found — skipping Legals publish.');
  } else {
    let lo = Math.min(...core);
    let hi = Math.max(...core);
    while (hi + 1 < n && (core.includes(hi + 1) || isImageOnly(texts[hi + 1]))) hi += 1;
    while (lo - 1 >= 0 && (core.includes(lo - 1) || isImageOnly(texts[lo - 1]))) lo -= 1;
    const LEGALS_OUT = 'out/issue-legals.pdf';
    console.log(`Legals section: pages ${lo + 1}-${hi + 1} (${hi - lo + 1} pages). Extracting …`);
    execFileSync(GS, [
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook',
      `-dFirstPage=${lo + 1}`, `-dLastPage=${hi + 1}`,
      '-dColorImageResolution=110', '-dGrayImageResolution=110', '-dMonoImageResolution=300',
      '-dNOPAUSE', '-dBATCH', '-dQUIET', `-sOutputFile=${LEGALS_OUT}`, SRC,
    ], { stdio: 'inherit' });
    const legalsBytes = statSync(LEGALS_OUT).size;
    const lSigned = await api({ action: 'sign' }, 'legals');
    const lPut = await fetch(lSigned.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      body: readFileSync(LEGALS_OUT),
    });
    if (!lPut.ok) throw new Error(`Legals upload failed (${lPut.status})`);
    await api({
      action: 'record',
      legal_date: issueDate,
      storage_path: lSigned.path,
      file_name: `SSP Legals ${issueDate}.pdf`,
    }, 'legals');
    console.log(`Legals published: ${issueDate}, ${hi - lo + 1} pages, ${(legalsBytes / 1e6).toFixed(1)} MB.`);
  }
} catch (err) {
  // The paper itself is already archived — a legals failure still fails the
  // step visibly (so CI notices), but only after the DP publish succeeded.
  console.error('Legals publish FAILED:', err.message);
  process.exit(1);
}
