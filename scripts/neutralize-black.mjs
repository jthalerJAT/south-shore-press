/**
 * Press pre-pass: rewrite every NEUTRAL RGB color (R==G==B) in a PDF's content
 * streams to DeviceGray, so that the downstream RGB->CMYK separation renders it
 * as K-only (no rich black). Color content (photos, tinted UI) is untouched.
 *
 * Why: our HTML renderer (Chromium) emits black text/rules as "0 0 0 rg"
 * (RGB black). A colorimetric ICC conversion reproduces that as rich black
 * (ink on all four plates), which violates the printer's K-only-black rule and
 * blows past the newsprint ink limit. Ghostscript has no "preserve black"
 * option, so we do it here at the source-color level.
 *
 *   node scripts/neutralize-black.mjs in.pdf out.pdf
 *
 * Operates on classic-xref PDFs with FlateDecode content streams (what Chromium
 * emits). Rebuilds the object table + xref from scratch so byte offsets stay
 * correct after the edits.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node scripts/neutralize-black.mjs <in.pdf> <out.pdf>');
  process.exit(1);
}

const s = readFileSync(inPath).toString('latin1'); // 1 byte -> 1 char, reversible

// ── Parse every "N G obj … endobj" block ─────────────────────────────────────
const objRe = /(\d+)\s+(\d+)\s+obj\b([\s\S]*?)\bendobj/g;
const objects = new Map(); // num -> { gen, body }
let m;
while ((m = objRe.exec(s))) {
  objects.set(parseInt(m[1], 10), { gen: parseInt(m[2], 10), body: m[3] });
}

// ── Trailer (Root/Info/Size) ─────────────────────────────────────────────────
const trailerMatch = s.match(/trailer\s*<<([\s\S]*?)>>\s*startxref/);
const trailerDict = trailerMatch ? trailerMatch[1] : '';
const rootRef = (trailerDict.match(/\/Root\s+(\d+\s+\d+\s+R)/) || [])[1] || null;
const infoRef = (trailerDict.match(/\/Info\s+(\d+\s+\d+\s+R)/) || [])[1] || null;
const idArr = (trailerDict.match(/\/ID\s*(\[[\s\S]*?\])/) || [])[1] || null;

// ── Rewrite neutral color operators inside a decoded content stream ───────────
// Channels this close together (max-min) count as "neutral" and get snapped to
// gray. Catches Tailwind slate near-blacks (e.g. .094/.094/.106 headlines) that
// are visually black but not exactly equal — without touching real colors (the
// blue flag .12/.23/.54 and red .78/.06/.18 are far from neutral).
const NEUTRAL_TOL = 0.06;

function neutralizeContent(text) {
  let fillN = 0;
  let strokeN = 0;
  // "r g b rg" (fill) and "r g b RG" (stroke). If the three numbers are within
  // tolerance, emit "v g" / "v G" (DeviceGray) using their mean -> K-only after
  // separation. Numbers are PDF reals (e.g. 0, .0667, 1).
  const colorRe = /(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(rg|RG)\b/g;
  const out = text.replace(colorRe, (whole, rs, gs, bs, op) => {
    const r = parseFloat(rs), g = parseFloat(gs), b = parseFloat(bs);
    if (Math.max(r, g, b) - Math.min(r, g, b) <= NEUTRAL_TOL) {
      if (op === 'rg') fillN++; else strokeN++;
      const v = ((r + g + b) / 3).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      return `${v} ${op === 'rg' ? 'g' : 'G'}`;
    }
    return whole;
  });
  return { out, fillN, strokeN };
}

let editedStreams = 0;
let totalFill = 0;
let totalStroke = 0;

for (const [num, obj] of objects) {
  const { body } = obj;
  if (!/\/FlateDecode\b/.test(body)) continue;
  const sm = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!sm) continue;
  let inflated;
  try {
    inflated = zlib.inflateSync(Buffer.from(sm[1], 'latin1'));
  } catch {
    continue; // not a flate content stream we can touch (e.g. image data)
  }
  const text = inflated.toString('latin1');
  // Only touch streams that actually carry page-drawing color operators.
  if (!/\b(rg|RG)\b/.test(text)) continue;
  const { out, fillN, strokeN } = neutralizeContent(text);
  if (fillN + strokeN === 0) continue;

  const deflated = zlib.deflateSync(Buffer.from(out, 'latin1'));
  const newStreamStr = deflated.toString('latin1');

  // Rebuild this object's body: swap stream bytes + fix /Length (direct or ref).
  let newBody = body.replace(
    /stream\r?\n[\s\S]*?\r?\nendstream/,
    `stream\n${newStreamStr}\nendstream`
  );
  newBody = newBody.replace(/\/Length\s+\d+(\s+\d+\s+R)?/, `/Length ${deflated.length}`);
  objects.set(num, { ...obj, body: newBody });

  editedStreams++;
  totalFill += fillN;
  totalStroke += strokeN;
}

// ── Re-serialize: header + objects (ascending) + fresh xref + trailer ─────────
const maxNum = Math.max(...objects.keys());
let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
const offsets = new Array(maxNum + 1).fill(null);

for (let n = 1; n <= maxNum; n++) {
  const obj = objects.get(n);
  if (!obj) continue;
  offsets[n] = out.length;
  out += `${n} ${obj.gen} obj${obj.body}endobj\n`;
}

const xrefStart = out.length;
let xref = `xref\n0 ${maxNum + 1}\n0000000000 65535 f \n`;
for (let n = 1; n <= maxNum; n++) {
  if (offsets[n] === null) {
    xref += `0000000000 65535 f \n`;
  } else {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
}

let trailer = `trailer\n<< /Size ${maxNum + 1}`;
if (rootRef) trailer += ` /Root ${rootRef}`;
if (infoRef) trailer += ` /Info ${infoRef}`;
if (idArr) trailer += ` /ID ${idArr}`;
trailer += ` >>\nstartxref\n${xrefStart}\n%%EOF\n`;

writeFileSync(outPath, Buffer.from(out + xref + trailer, 'latin1'));
console.log(
  `neutralized ${totalFill} fill + ${totalStroke} stroke ops across ${editedStreams} stream(s) -> ${outPath}`
);
