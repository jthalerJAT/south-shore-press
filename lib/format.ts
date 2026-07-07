/**
 * Mailing-label field normalizers. Applied on every write into the master
 * `accounts` record so names / addresses / states / phones land in one standard
 * format regardless of how they were typed or imported (e.g. ALL-CAPS mailer
 * exports). Client-safe (no imports) so forms and server actions share them.
 */

/** Title Case: first letter of each word upper, the rest lower. Word breaks are
 *  spaces, hyphens, apostrophes, slashes, and periods (so "o'brien" → "O'Brien",
 *  "950 rice rd" → "950 Rice Rd", "st. james" → "St. James"). Digits untouched. */
export function titleCase(input: string | null | undefined): string {
  const s = (input ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'/.])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'puerto rico': 'PR', 'virgin islands': 'VI', guam: 'GU',
  'american samoa': 'AS', 'northern mariana islands': 'MP',
};

/** Two-letter USPS state abbreviation. Maps full names; upper-cases anything
 *  already two letters; otherwise upper-cases as a best effort. */
export function normalizeState(input: string | null | undefined): string {
  const s = (input ?? '').trim();
  if (!s) return '';
  if (s.length === 2) return s.toUpperCase();
  const key = s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return STATE_ABBR[key] ?? s.toUpperCase();
}

/** (xxx) xxx-xxxx for a 10-digit US number (tolerates a leading 1). Anything
 *  that isn't 10 digits is left as typed. */
export function formatPhone(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  const d = raw.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return raw;
}

/** Parse a stored date ('YYYY-MM-DD' or ISO) into a local-midnight Date, so
 *  date-only values don't shift a day across time zones. Null if unparseable. */
export function parseDateLocal(v: string | null | undefined): Date | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a stored date as MM/DD/YY (US). Empty → ''. Unparseable → raw value. */
export function formatDate(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  const d = parseDateLocal(s);
  if (!d) return s;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}/${dd}/${yy}`;
}

/** Normalize a ZIP: 9 digits → "#####-####", 5 digits → "#####". (The +4 suffix
 *  itself will be filled by the USPS lookup later; this just standardizes what's
 *  already there.) */
export function normalizeZip(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 5) return d;
  return raw;
}
