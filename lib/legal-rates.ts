/**
 * SSP legal-notice rate card (adopted 2026-10-21, effective immediately) -
 * reverse-engineered from the Aug 5 – Oct 21 2026 billing and memorialized
 * in the "SSP Legal Notice Rates Memo". Client-safe, pure.
 *
 *   Public bodies   words × ($0.085 × weeks + $0.025) - statute-safe
 *                   per-word form of the §70-a line rate (circ. 6,000,
 *                   5,000–7,499 band); no processing fee; scanned notarized
 *                   affidavit emailed free.
 *   Everyone else   words × $0.19 × weeks + $25 fee, minimum $35/run.
 *   LLC/PLLC/LLP    $125 flat per 6-week statutory run.
 *   Liquor license  $125 flat per 2-week run.
 *   Mailed affidavit +$10 for ANY client (a mailing charge) when a physical
 *                   notarized original is requested - the notary checkbox.
 *
 * Display/scanned exhibits ($500/page/run) and wide-set notices (>~300
 * agate lines, quoted by space) can't be detected from text alone and are
 * quoted by hand - the computed figure is a reference, not an invoice.
 */

export type RateTier = 'public' | 'market' | 'llc' | 'liquor';

export type RateQuote = {
  amount: number;
  tier: RateTier;
  /** The math, for tooltips: e.g. "164 words × ($0.085 × 1 wk + $0.025)". */
  basis: string;
};

// Customer names that mark a public body (§70-a tier).
const PUBLIC_CUSTOMER_RE =
  /\b(fire district|town of|village of|school district|library district|water district|sewer district|park district|board of education|planning board|zoning board|housing authority)\b/i;
// Body-text markers safe from false positives - foreclosure notices routinely
// name a town in the property description, so "town of" is customer-only.
const PUBLIC_BODY_TEXT_RE =
  /\b(fire district|board of fire commissioners|school district|board of education|planning board|zoning board|town board|village board|permissive referendum)\b/i;
const LLC_RE =
  /\b(notice of (formation|registration|qualification)|articles of organization|limited liability compan)/i;
const LIQUOR_RE = /\bliquor license\b/i;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function quoteLegal(input: {
  words: number | null;
  weeks: number | null;
  header?: string | null;
  body?: string | null;
  customer?: string | null;
  /** "Notarized copy to be mailed" - adds the $10 mailing charge, any tier. */
  mailedAffidavit?: boolean;
}): RateQuote | null {
  const withMailing = (q: RateQuote): RateQuote =>
    input.mailedAffidavit
      ? { ...q, amount: round2(q.amount + 10), basis: `${q.basis} + $10 mailed affidavit` }
      : q;

  const text = `${input.header ?? ''} ${input.body ?? ''}`;
  if (LIQUOR_RE.test(text)) {
    return withMailing({
      amount: 125,
      tier: 'liquor',
      basis: 'Liquor-license flat rate: $125 per 2-week run',
    });
  }
  if (LLC_RE.test(text)) {
    return withMailing({
      amount: 125,
      tier: 'llc',
      basis: 'LLC/PLLC/LLP formation flat rate: $125 per 6-week run',
    });
  }
  const { words, weeks } = input;
  if (!words || !weeks) return null;

  const isPublic =
    PUBLIC_CUSTOMER_RE.test(input.customer ?? '') || PUBLIC_BODY_TEXT_RE.test(text);
  if (isPublic) {
    return withMailing({
      amount: round2(words * (0.085 * weeks + 0.025)),
      tier: 'public',
      basis: `Public body: ${words} words × ($0.085 × ${weeks} wk + $0.025) - statutory rate, no fee, scanned affidavit free`,
    });
  }
  const raw = words * 0.19 * weeks + 25;
  return withMailing({
    amount: round2(Math.max(35, raw)),
    tier: 'market',
    basis:
      `Market: ${words} words × $0.19 × ${weeks} wk + $25 fee` +
      (raw < 35 ? ' (minimum $35)' : ''),
  });
}

export function wordCount(s: string | null | undefined): number {
  const t = (s ?? '').trim();
  return t ? t.split(/\s+/).length : 0;
}
