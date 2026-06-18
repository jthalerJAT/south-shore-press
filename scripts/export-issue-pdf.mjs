/**
 * Export the issue (or specific pages) to a press-ready PDF.
 *
 *   1. Headless Chromium renders /print/issue at exact 11x15 trim -> RGB PDF.
 *   2. Ghostscript converts -> PDF/X-1a:2001 (CMYK, flattened, 1.3).
 *
 * Usage (from the repo root):
 *   INDESIGN_API_TOKEN=<token> node scripts/export-issue-pdf.mjs
 *
 * Env:
 *   INDESIGN_API_TOKEN  (required) same token as the print API.
 *   PRINT_BASE          default https://south-shore-press.vercel.app
 *   PAGES               default "1,2" (page numbers; omit/"" for all included)
 *   CMYK_ICC            path to a CMYK ICC profile (the printer's, ideally).
 *                       If unset, tries Ghostscript's bundled default_cmyk.icc.
 *   GS                  Ghostscript binary (default gswin64c on Windows, gs else)
 *
 * Output: out/issue-rgb.pdf and out/issue-x1a.pdf
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');
const outDir = join(repoRoot, 'out');
mkdirSync(outDir, { recursive: true });

// Zero-config locally: fall back to INDESIGN_API_TOKEN in .env.local so
// `npm run export:issue` needs no inline env. (.env.local is gitignored.)
function envLocalToken() {
  try {
    const txt = readFileSync(join(repoRoot, '.env.local'), 'utf8');
    const m = txt.match(/^\s*INDESIGN_API_TOKEN\s*=\s*["']?([^"'\r\n]+)/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const BASE = (process.env.PRINT_BASE || 'https://south-shore-press.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.INDESIGN_API_TOKEN || envLocalToken();
// Default to the WHOLE issue (all included pages); set PAGES=1,2 to limit.
const PAGES = process.env.PAGES ?? '';
const OPEN_WHEN_DONE = process.env.OPEN !== '0';
if (!TOKEN) {
  console.error('ERROR: set INDESIGN_API_TOKEN (env or .env.local) — same token as the print API.');
  process.exit(1);
}

const rgb = join(outDir, 'issue-rgb.pdf');
const prepped = join(outDir, 'issue-rgb-k.pdf');
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

// ── 1b. Press pre-pass: neutral RGB -> DeviceGray so black separates K-only ──
// Chromium emits black text/rules as RGB (0,0,0); a colorimetric CMYK
// conversion would turn that into rich black. Rewriting neutrals to DeviceGray
// makes Ghostscript separate them to K-only (verified: DeviceGray -> K, no CMY).
execFileSync(process.execPath, [join(__dir, 'neutralize-black.mjs'), rgb, prepped], {
  stdio: 'inherit',
});

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
  // 2. A newsprint profile checked into the repo next to this script.
  const repoSnap = join(__dir, 'pdfx', 'USNewsprintSNAP2007.icc');
  if (existsSync(repoSnap)) return repoSnap;
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
const defResolved = defTemplate.replace('__ICC_PROFILE__', icc.replace(/\\/g, '/'));
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
  '-dPDFACompatibilityPolicy=1',
  '-dPDFXSETBLEEDBOXTOMEDIABOX=true',
  `-sOutputICCProfile=${icc.replace(/\\/g, '/')}`,
  `-sOutputFile=${x1a}`,
  defPath,
  prepped, // K-only-prepped input, not the raw RGB
];

try {
  console.log('Running Ghostscript…');
  execFileSync(gsBin, gsArgs, { stdio: 'inherit' });
  console.log('\n✓ PDF/X-1a ->', x1a);
  console.log('Send this file to the printer (or a PDF/X preflight) to confirm it passes.');
} catch (e) {
  console.error('\n! Ghostscript failed:', e.message);
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
