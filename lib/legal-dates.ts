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
 *  and — when the last line is the standard "L40001 8/5/26, 8/12/26" footer —
 *  the L# and first/last run dates (ISO). Anything unparseable comes back
 *  blank; the copy is returned untouched in that case. */
export function parseLegalPrint(print: string): {
  copy: string;
  lNumber: string;
  startDate: string;
  endDate: string;
} {
  const lines = print.trimEnd().split('\n');
  const last = (lines[lines.length - 1] ?? '').trim();
  const m = last.match(/^(L\d{5,})\b\s*(.*)$/);
  if (!m) return { copy: print, lNumber: '', startDate: '', endDate: '' };
  const lNumber = m[1];
  const copy = lines.slice(0, -1).join('\n').trimEnd();
  const dateTokens = (m[2] ?? '').match(/\b\d{1,2}\/\d{1,2}\/\d{2}\b/g) ?? [];
  const iso = dateTokens.map((t) => {
    const [mo, d, y] = t.split('/').map(Number);
    return `20${String(y).padStart(2, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });
  return {
    copy,
    lNumber,
    startDate: iso[0] ?? '',
    endDate: iso[iso.length - 1] ?? '',
  };
}
