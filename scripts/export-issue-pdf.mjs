/**
 * Export the issue (or specific pages) to a press-ready PDF.
 *
 *   1. Headless Chromium renders /print/issue at exact 11x15 trim -> RGB PDF.
 *   2. Ghostscript converts -> PDF/X-1a:2001 (CMYK, flattened, 1.3).
 *
 * Usage (from the repo root):
 *   PRINT_API_TOKEN=<token> node scripts/export-issue-pdf.mjs
 *
 * Env:
 *   PRINT_API_TOKEN     (required) same token that guards /print/issue.
 *                       (Legacy INDESIGN_API_TOKEN is still accepted.)
 *   PRINT_BASE          default https://south-shore-press.vercel.app
 *   PAGES               default "1,2" (page numbers; omit/"" for all included)
 *   CMYK_ICC            path to a CMYK ICC profile (the printer's, ideally).
 *                       If unset, tries Ghostscript's bundled default_cmyk.icc.
 *   GS                  Ghostscript binary (default gswin64c on Windows, gs else)
 *
 * Output: out/issue-rgb.pdf and out/issue-x1a.pdf
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');
const outDir = join(repoRoot, 'out');
mkdirSync(outDir, { recursive: true });

// Zero-config locally: fall back to the token in .env.local so
// `npm run export:issue` needs no inline env. (.env.local is gitignored.)
// Accepts PRINT_API_TOKEN or the legacy INDESIGN_API_TOKEN name.
function envLocalToken() {
  try {
    const txt = readFileSync(join(repoRoot, '.env.local'), 'utf8');
    const m = txt.match(/^\s*(?:PRINT_API_TOKEN|INDESIGN_API_TOKEN)\s*=\s*["']?([^"'\r\n]+)/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const BASE = (process.env.PRINT_BASE || 'https://south-shore-press.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.PRINT_API_TOKEN || process.env.INDESIGN_API_TOKEN || envLocalToken();
// Default to the WHOLE issue (all included pages); set PAGES=1,2 to limit.
const PAGES = process.env.PAGES ?? '';
const OPEN_WHEN_DONE = process.env.OPEN !== '0';
if (!TOKEN) {
  console.error('ERROR: set PRINT_API_TOKEN (env or .env.local) — same token that guards /print/issue.');
  process.exit(1);
}

const rgb = join(outDir, 'issue-rgb.pdf');
const x1a = join(outDir, 'issue-x1a.pdf');

// ── 1. Render to RGB PDF via Playwright ──────────────────────────────────────
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('ERROR: Playwright not installed. Run:  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const url = `${BASE}/print/issue?token=${encodeURIComponent(TOKEN)}${PAGES ? `&pages=${encodeURIComponent(PAGES)}` : ''}`;
console.log('Rendering:', url);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  if (!resp || !resp.ok()) throw new Error(`print page returned HTTP ${resp ? resp.status() : '??'}`);
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(2500); // let client measurement + copyfit settle

  // ── 1a-pre. Verify every photo actually loaded ──────────────────────────
  // networkidle can pass even when an image request failed (429/drop) — the
  // <img> then prints as a blank gray box (the printer's "missing photos",
  // 2026-07-15 issue, p34). Retry each failed image once with a cache-buster,
  // then name anything still broken in the log instead of letting the printer
  // find it.
  const brokenImages = await page.evaluate(async () => {
    const bad = () => Array.from(document.images).filter((im) => !(im.complete && im.naturalWidth > 0));
    await Promise.all(
      bad().map(
        (im) =>
          new Promise((res) => {
            const done = () => res(undefined);
            im.addEventListener('load', done, { once: true });
            im.addEventListener('error', done, { once: true });
            setTimeout(done, 15000);
            try {
              const u = new URL(im.src, location.href);
              u.searchParams.set('ssp-retry', String(Date.now()));
              im.src = u.href;
            } catch {
              done();
            }
          })
      )
    );
    return bad().map((im) => {
      const sheet = im.closest('.ssp-pg');
      const ordinal = sheet ? Array.from(document.querySelectorAll('.ssp-pg')).indexOf(sheet) + 1 : null;
      return { src: im.src, sheet: ordinal };
    });
  });
  for (const im of brokenImages) {
    console.warn(`!! MISSING IMAGE${im.sheet ? ` on sheet ${im.sheet}` : ''}: ${im.src} — it will print blank.`);
  }
  if (brokenImages.length > 0) {
    console.warn(`!! ${brokenImages.length} image(s) failed to load. The export continues, but check the pages above before sending to the printer.`);
  }

  // ── 1a. Rasterize PDF frames ────────────────────────────────────────────
  // On screen, PDFs (classifieds, PDF ad copy) render in the browser's NATIVE
  // viewer via <iframe> — but headless page.pdf() prints those frames BLANK
  // (no PDF plugin in the print raster; verified 2026-07-13). Before printing,
  // swap each PDF iframe for a Ghostscript-rendered PNG of its first page.
  // Ghostscript also handles the non-embedded fonts that made pdf.js
  // unusable for legal-notice PDFs.
  const pdfFrames = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('iframe[src]').forEach((f) => {
      const raw = f.getAttribute('src') || '';
      const clean = raw.split('#')[0].split('?')[0];
      if (clean.toLowerCase().endsWith('.pdf')) {
        const id = `pdfswap-${list.length}`;
        f.setAttribute('data-pdfswap', id);
        list.push({ id, url: new URL(clean, location.href).href });
      }
    });
    return list;
  });
  if (pdfFrames.length > 0) {
    console.log(`Rasterizing ${pdfFrames.length} PDF frame(s) for print…`);
    const gsRaster = resolveGsBin();
    for (const fr of pdfFrames) {
      const tmpPdf = join(outDir, `${fr.id}.pdf`);
      const tmpPng = join(outDir, `${fr.id}.png`);
      try {
        const res = await fetch(fr.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeFileSync(tmpPdf, Buffer.from(await res.arrayBuffer()));
        execFileSync(
          gsRaster,
          ['-dNOPAUSE', '-dBATCH', '-sDEVICE=png16m', '-r200', '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${tmpPng}`, tmpPdf],
          { stdio: 'ignore' }
        );
        const b64 = readFileSync(tmpPng).toString('base64');
        await page.evaluate(
          ([id, data]) => {
            const f = document.querySelector(`iframe[data-pdfswap="${id}"]`);
            if (!f) return;
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${data}`;
            const cs = getComputedStyle(f);
            img.style.width = cs.width;
            img.style.height = cs.height;
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            f.replaceWith(img);
          },
          [fr.id, b64]
        );
        console.log(`  ✓ ${fr.url.split('/').pop()}`);
      } catch (e) {
        console.warn(`  ! Could not rasterize ${fr.url}: ${e.message} — it will print blank.`);
      } finally {
        for (const p of [tmpPdf, tmpPng]) {
          try {
            rmSync(p, { force: true });
          } catch {
            /* best-effort cleanup */
          }
        }
      }
    }
    await page.waitForTimeout(500); // let the swapped images decode
  }

  try {
    await page.pdf({ path: rgb, printBackground: true, preferCSSPageSize: true });
  } catch (e) {
    if (e && e.code === 'EBUSY') {
      console.error(`\n! Can't write ${rgb} — it's open in another program.`);
      console.error('  Close any open issue PDF (your viewer) and re-run.');
      process.exit(1);
    }
    throw e;
  }
  console.log('✓ RGB PDF  ->', rgb);
} finally {
  await browser.close();
}

// ── 1b. K-only black pre-pass (mupdf stream rewrite) ─────────────────────────
// Chromium paints text/rules in near-neutral RGB (zinc-900 carries a blue
// tint); a colorimetric CMYK conversion turns that into rich black — a
// registration hazard on newsprint. Two prior attempts both failed:
//   - neutralize-black.mjs hand-rewrote compressed streams and corrupted them
//     (bad zlib checksums, broken BT/ET pairs).
//   - -dBlackText/-dBlackVector do NOT mean "keep black K-only": in gs 10.x
//     they force ALL non-white text/vectors TO black (an ink-saving mode) —
//     they printed every navy flag, red badge, and the History page's cream
//     boxes solid black on the 2026-07-15 issue.
// This pass uses mupdf's PDF API (proper decompress/recompress, no hand-rolled
// zlib): any near-neutral `r g b rg/RG` paint op in a content/form/soft-mask
// stream becomes DeviceGray, which pdfwrite's default DeviceGrayToK then emits
// as K-only. Photos are untouched (image data, not paint ops).
const kOnly = join(outDir, 'issue-k.pdf');
let gsInput = rgb;
try {
  const mupdf = await import('mupdf');
  const doc = mupdf.PDFDocument.openDocument(readFileSync(rgb), 'application/pdf');
  const GRAY_PAINT = /(^|[\s])([\d.]+) ([\d.]+) ([\d.]+) (rg|RG)(?=[\s])/g;
  const seenStreams = new Set();
  let rewritten = 0;

  const rewriteStream = (ref) => {
    const num = ref.isIndirect() ? ref.asIndirect() : -1;
    if (num >= 0) {
      if (seenStreams.has(num)) return;
      seenStreams.add(num);
    }
    let txt;
    try {
      txt = Buffer.from(ref.readStream().asUint8Array()).toString('latin1');
    } catch {
      return;
    }
    if (!/ (rg|RG)[\s]/.test(txt)) return;
    const next = txt.replace(GRAY_PAINT, (all, pre, r, g, b, op) => {
      const [rf, gf, bf] = [parseFloat(r), parseFloat(g), parseFloat(b)];
      if (Math.max(rf, gf, bf) - Math.min(rf, gf, bf) > 0.06) return all;
      const luma = Math.round((0.299 * rf + 0.587 * gf + 0.114 * bf) * 10000) / 10000;
      return `${pre}${luma} ${op === 'rg' ? 'g' : 'G'}`;
    });
    if (next !== txt) {
      // latin1 keeps a byte-for-byte round trip (TextEncoder is UTF-8 and
      // would mangle any binary string data in the stream).
      ref.writeStream(new Uint8Array(Buffer.from(next, 'latin1')));
      rewritten++;
    }
  };

  const walkResources = (res, depth) => {
    if (!res || res.isNull() || depth > 12) return;
    const r = res.resolve();
    if (!r || !r.isDictionary()) return;
    const egs = r.get('ExtGState');
    if (egs && !egs.isNull()) {
      egs.resolve().forEach((v) => {
        const sm = v.resolve()?.get?.('SMask');
        if (sm && !sm.isNull() && sm.resolve()?.isDictionary?.()) {
          const g = sm.resolve().get('G');
          if (g && !g.isNull()) {
            rewriteStream(g);
            walkResources(g.resolve().get('Resources'), depth + 1);
          }
        }
      });
    }
    const xo = r.get('XObject');
    if (xo && !xo.isNull()) {
      xo.resolve().forEach((v) => {
        const d = v.resolve();
        if (d?.get?.('Subtype')?.toString?.() === '/Form') {
          rewriteStream(v);
          walkResources(d.get('Resources'), depth + 1);
        }
      });
    }
  };

  for (let i = 0; i < doc.countPages(); i++) {
    const pobj = doc.loadPage(i).getObject();
    const contents = pobj.get('Contents');
    const carr = contents.resolve();
    if (carr.isArray()) {
      for (let j = 0; j < carr.length; j++) rewriteStream(carr.get(j));
    } else {
      rewriteStream(contents);
    }
    walkResources(pobj.get('Resources'), 0);
  }

  writeFileSync(kOnly, Buffer.from(doc.saveToBuffer('compress').asUint8Array()));
  gsInput = kOnly;
  console.log(`✓ K-only pre-pass: rewrote ${rewritten} stream(s) -> ${kOnly}`);
} catch (e) {
  console.warn(`! K-only pre-pass skipped (${e.message}) — black text will be rich black. npm i -D mupdf to enable.`);
}

// ── 2. Convert to PDF/X-1a CMYK via Ghostscript ──────────────────────────────
// Find the GS binary: env override, then PATH, then the user-dir Windows install
// (winget/admin-free install lands in %LOCALAPPDATA%\Ghostscript) or Program Files.
function resolveGsBin() {
  if (process.env.GS) return process.env.GS;
  if (process.platform !== 'win32') return 'gs';
  const roots = [
    join(process.env.LOCALAPPDATA || '', 'Ghostscript'),
    'C:/Program Files/gs',
    'C:/Program Files (x86)/gs',
  ];
  for (const r of roots) {
    if (!existsSync(r)) continue;
    for (const ver of readdirSync(r)) {
      const p = join(r, ver, 'bin', 'gswin64c.exe');
      if (existsSync(p)) return p;
    }
  }
  return 'gswin64c'; // hope it's on PATH
}
const gsBin = resolveGsBin();

function resolveIcc() {
  // 1. Explicit override (ideally the PRINTER's newsprint profile).
  if (process.env.CMYK_ICC && existsSync(process.env.CMYK_ICC)) return process.env.CMYK_ICC;
  // 2. Profiles next to this script. Must be ICC v2 — PDF/X-1a is a PDF 1.3
  //    standard and older Ghostscript dies mid-file on a v4 output intent
  //    (the runner's gs 10.02 failed on CGATS21_CRPC1 v4; local 10.07 coped).
  //    A locally dropped USNewsprintSNAP2007.icc (Adobe, gitignored) wins;
  //    default_cmyk.icc (Ghostscript's own, v2.1, AGPL-redistributable) is
  //    committed so CI always has a working profile.
  for (const name of ['USNewsprintSNAP2007.icc', 'default_cmyk.icc']) {
    const p = join(__dir, 'pdfx', name);
    if (existsSync(p)) return p;
  }
  // 3. The US newsprint profile Adobe CC installs (SNAP 2007) — correct for a
  //    U.S. paper: ~newsprint dot gain + ink limit, unlike the glossy default.
  const adobe = [
    'C:/Program Files (x86)/Common Files/Adobe/Color/Profiles/Recommended/USNewsprintSNAP2007.icc',
    'C:/Program Files/Common Files/Adobe/Color/Profiles/Recommended/USNewsprintSNAP2007.icc',
  ];
  for (const p of adobe) if (existsSync(p)) return p;
  // 4. Last resort: Ghostscript's bundled default_cmyk.icc (glossy — not ideal).
  const bases = ['C:/Program Files/gs', 'C:/Program Files (x86)/gs', join(process.env.LOCALAPPDATA || '', 'Ghostscript')];
  for (const b of bases) {
    if (!existsSync(b)) continue;
    for (const ver of readdirSync(b)) {
      const p = join(b, ver, 'iccprofiles', 'default_cmyk.icc');
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const icc = resolveIcc();
if (!icc) {
  console.warn('\n! No CMYK ICC profile found. RGB PDF is ready, but skipping PDF/X-1a.');
  console.warn('  Set CMYK_ICC to a CMYK .icc (ideally the printer profile) and re-run,');
  console.warn('  or install Ghostscript (it ships default_cmyk.icc).');
  process.exit(0);
}
console.log('CMYK profile:', icc);

const defTemplate = readFileSync(join(__dir, 'pdfx', 'PDFX_def.ps'), 'utf8');
// replaceAll: the template mentions the token in a comment BEFORE the real
// /ICCProfile reference — .replace() only substituted the comment, leaving
// Ghostscript to open the literal file "(__ICC_PROFILE__)" and die.
const defResolved = defTemplate.replaceAll('__ICC_PROFILE__', icc.replace(/\\/g, '/'));
const defPath = join(outDir, 'pdfx_def_resolved.ps');
writeFileSync(defPath, defResolved, 'utf8');

const gsArgs = [
  '-dPDFX',
  '-dBATCH',
  '-dNOPAUSE',
  '-dNOOUTERSAVE',
  '-dNOSAFER', // permit reading the ICC profile referenced by the def .ps
  '-sDEVICE=pdfwrite',
  '-dCompatibilityLevel=1.3',
  '-dPDFSETTINGS=/prepress',
  '-sColorConversionStrategy=CMYK',
  '-dProcessColorModel=/DeviceCMYK',
  // NO -dBlackText/-dBlackVector: those force all non-white text/vectors TO
  // black (gs 10.x ink-saving mode) — see the K-only pre-pass above for the
  // correct treatment of near-neutral blacks.
  '-dPDFACompatibilityPolicy=1',
  '-dPDFXSETBLEEDBOXTOMEDIABOX=true',
  `-sOutputICCProfile=${icc.replace(/\\/g, '/')}`,
  `-sOutputFile=${x1a}`,
  defPath,
  gsInput, // Chromium's RGB output after the K-only pre-pass
];

try {
  console.log('Running Ghostscript…');
  execFileSync(gsBin, gsArgs, { stdio: 'inherit' });
  console.log('\n✓ PDF/X-1a ->', x1a);
  console.log('Send this file to the printer (or a PDF/X preflight) to confirm it passes.');
} catch (e) {
  console.error('\n! Ghostscript failed:', e.message);
  if (e.status != null) console.error(`  exit status: ${e.status}`);
  if (e.signal) console.error(`  killed by signal: ${e.signal}`);
  console.error(`  Is Ghostscript installed and on PATH? (binary tried: ${gsBin})`);
  console.error('  RGB PDF is still available at', rgb);
  process.exit(1);
}

// ── 3. Open the result (local convenience; OPEN=0 to skip, e.g. in CI) ────────
if (OPEN_WHEN_DONE) {
  try {
    if (process.platform === 'win32') execFileSync('cmd', ['/c', 'start', '', x1a]);
    else if (process.platform === 'darwin') execFileSync('open', [x1a]);
  } catch {
    /* opening is best-effort */
  }
}
