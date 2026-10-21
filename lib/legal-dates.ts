/**
 * Wednesday date helpers for the Legal Portal — the paper runs on Wednesdays
 * only, so run dates are always the Wednesdays between a start and end date
 * (inclusive). Client-safe, no server imports. Dates are handled as
 * YYYY-MM-DD strings at noon UTC to dodge timezone off-by-ones.
 */

export function isWednesday(iso: string): boolean {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 3;
}

/** Every Wednesday from start to end inclusive (both must be Wednesdays). */
export function wednesdaysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** "8/5/26" — the compact date style printed at the end of a legal. */
export function shortLegalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`;
}

/** The full "L40001 8/5/26, 8/12/26" line appended to a legal's copy. */
export function legalFooterLine(lNumber: string, runDates: string[]): string {
  return `${lNumber} ${runDates.map(shortLegalDate).join(', ')}`;
}

/** Split a Legal Notices LIBRARY print text back into its parts: the copy,
 *  the L#, and the first/last run dates (ISO). Footers appear in the wild in
 *  several shapes — "L40001 8/5/26, 8/12/26" on its own line, or inline at
 *  the end of the last paragraph like "… Coram NY 11727. L19599 - 9/23/2026
 *  & 9/30/2026" — so this takes the LAST L# in the text and accepts it as a
 *  footer only when nothing but dates and separators follow it. Anything
 *  unparseable comes back blank with the copy untouched. */
export function parseLegalPrint(print: string): {
  copy: string;
  lNumber: string;
  startDate: string;
  endDate: string;
  /** How many run dates the footer listed (0 when unparseable). */
  runCount: number;
} {
  const none = { copy: print, lNumber: '', startDate: '', endDate: '', runCount: 0 };
  const text = print.trimEnd();
  const lnRe = /\bL\d{5,}\b/g;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = lnRe.exec(text))) last = m;
  if (!last) return none;

  const tail = text.slice(last.index + last[0].length);
  const dateRe = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g;
  // After the L#, only run dates and separators may remain — otherwise that
  // L# was a reference inside the copy, not the footer.
  const leftover = tail
    .replace(dateRe, '')
    .replace(/&amp;/g, '')
    .replace(/\band\b/gi, '')
    .replace(/[\s,.;:&()–—-]+/g, '');
  if (leftover) return none;

  const iso: string[] = [];
  let d: RegExpExecArray | null;
  dateRe.lastIndex = 0;
  while ((d = dateRe.exec(tail))) {
    const mo = Number(d[1]);
    const day = Number(d[2]);
    const y = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
    iso.push(`${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return {
    copy: text.slice(0, last.index).replace(/[\s]+$/, ''),
    lNumber: last[0],
    startDate: iso[0] ?? '',
    endDate: iso[iso.length - 1] ?? '',
    runCount: iso.length,
  };
}
