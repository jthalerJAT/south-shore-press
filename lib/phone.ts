/**
 * US phone number formatting helpers. All inputs/displays in the
 * v2 site are US-only for now (Suffolk County, NY readers); revisit
 * if we ever expand outside North America.
 */

/**
 * Live-input mask. Strips non-digits, caps at 10 digits, and renders
 * progressively as the user types:
 *   "2"         → "(2"
 *   "212"       → "(212"
 *   "2125"      → "(212) 5"
 *   "212555"    → "(212) 555"
 *   "2125551"   → "(212) 555-1"
 *   "2125551234"→ "(212) 555-1234"
 *
 * Handles pasted formatted input (re-extracts the digits, re-formats).
 * Returns empty string for empty input so the placeholder shows.
 */
export function maskPhoneInput(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Display formatter. Accepts any input (digits-only, formatted,
 * partial) and returns the canonical "(xxx) xxx-xxxx" form when 10
 * digits are present. If the input doesn't yield 10 digits, returns
 * the original string (so legacy / malformed data isn't silently
 * destroyed).
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  // Trim a leading country code "1" so "12125551234" -> "2125551234".
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Normalize a phone input to digits-only for storage. Strips formatting
 * AND a leading "1" country code. Returns null for empty / invalid
 * input so we don't persist garbage to the DB.
 */
export function normalizePhoneForStorage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length === 0) return null;
  return digits;
}
