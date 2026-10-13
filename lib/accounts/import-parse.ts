/**
 * Account-import parsing — shared by the import dialog and the Web Worker that
 * runs it off the main thread (publisher report 2026-10-13: a full Master
 * Distribution List froze the tab at "Reading…" until Chrome offered to kill
 * the page). Pure logic, no DOM and no React: `XLSX` is passed in so the
 * caller controls how the library is loaded.
 */

export type Field =
  | 'first_name'
  | 'last_name'
  | 'company'
  | 'address_1'
  | 'address_2'
  | 'city'
  | 'state'
  | 'zip'
  /** Parse-only: merged into `zip` as 11968-5339 and never stored on its own. */
  | 'zip4'
  | 'email'
  | 'phone'
  | 'acs_keyline'
  | 'account_number'
  | 'subscription_start'
  | 'subscription_end'
  | 'last_payment_amount';

export type ParsedRow = Partial<Record<Field, string>>;

export const FIELD_LABELS: Record<Field, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  company: 'Company',
  address_1: 'Address 1',
  address_2: 'Address 2',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  zip4: 'ZIP+4',
  email: 'Email',
  phone: 'Phone',
  acs_keyline: 'ACS Keyline',
  account_number: 'Account ID',
  subscription_start: 'Start Date',
  subscription_end: 'Expiration Date',
  last_payment_amount: 'Amount Paid',
};

/** Map a spreadsheet header to one of our fields (order matters — address 2
 *  before address 1, etc.). Tolerant of the "Subscriber …" prefixes. */
export function matchField(header: string): Field | null {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/address2|addr2|addressline2/.test(h)) return 'address_2';
  if (/address1|addr1|addressline1|streetaddress/.test(h)) return 'address_1';
  if (/address|street/.test(h)) return 'address_1';
  if (/firstname|fname|givenname/.test(h) || h === 'first') return 'first_name';
  if (/lastname|lname|surname|familyname/.test(h) || h === 'last') return 'last_name';
  if (/company|business|organization|organisation/.test(h)) return 'company';
  if (/emailaddress|email/.test(h)) return 'email';
  if (/phone|tel|mobile|cell/.test(h)) return 'phone';
  if (/city|town/.test(h)) return 'city';
  if (/state|province|region/.test(h)) return 'state';
  // The 4-digit add-on arrives as its own column ("Zip 4", "ZIP+4", "Plus4").
  // Must be tested BEFORE the plain zip rule, which would swallow it.
  if (/^(zip|postal)?(code)?(plus|add|addon)?4$/.test(h) || /zip4|plus4|zipplus/.test(h)) return 'zip4';
  if (/zip|postal/.test(h)) return 'zip';
  if (/acs|keyline/.test(h)) return 'acs_keyline';
  if (/accountid|accountnumber|acct/.test(h) || h === 'account') return 'account_number';
  if (/amountpaid|paymentamount|amount/.test(h)) return 'last_payment_amount';
  if (/paymentstart|startdate|datestarted|substart|subscriptionstart/.test(h)) return 'subscription_start';
  if (/expir|paymentexpire|enddate|expiredate|subend|subscriptionend/.test(h)) return 'subscription_end';
  return null;
}

/**
 * Join a "ZIP" column and a separate "ZIP 4" column into one stored ZIP:
 * 11968 + 5339 → "11968-5339" (publisher direction 2026-10-13).
 *
 * Excel stores both as numbers and drops leading zeros (06880 → 6880,
 * 0339 → 339), so each half is padded back. A ZIP that already carries its
 * add-on (9 digits, or "11968-5339") is kept as it is.
 */
export function joinZip(zip: string | undefined, zip4: string | undefined): string {
  const z = (zip ?? '').replace(/\D/g, '');
  const four = (zip4 ?? '').replace(/\D/g, '');
  if (!z) return (zip ?? '').trim();
  // "0" / "0000" in the add-on column means "none", not add-on zero.
  const fourClean = /^0*$/.test(four) ? '' : four;
  const five = z.length >= 9 ? z.slice(0, 5) : z.length === 4 ? `0${z}` : z;
  const addOn =
    z.length >= 9 ? z.slice(5, 9) : fourClean ? fourClean.padStart(4, '0').slice(-4) : '';
  return addOn ? `${five}-${addOn}` : five;
}

/** Shrink a sheet's declared range (`!ref`) to the cells that actually hold
 *  values. Excel routinely declares ranges out to column XFD / row 1048576
 *  (stray formatting does it), and `sheet_to_json` materializes EVERY declared
 *  cell — a real mailer list declared as B2:XFD5988 is ~98 million cells and
 *  locks the browser. The sheet object is sparse, so scanning its real keys is
 *  cheap. */
export function trimSheetRange(
  XLSX: typeof import('xlsx'),
  sheet: import('xlsx').WorkSheet
): void {
  if (!sheet['!ref']) return;
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -1;
  let maxC = -1;
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const cell = sheet[key];
    if (cell == null) continue;
    // Blank = no usable VALUE. Formulas don't matter — the import consumes
    // computed values only. The real-world trigger was a single cell
    // XFD984="" (a formula evaluating to empty) declaring the full
    // 16,384-column width.
    if (cell.v == null || (typeof cell.v === 'string' && cell.v.trim() === '')) continue;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  if (maxR < 0) return; // truly empty — leave as-is; caller reports "no data"
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
}

export type ParseResult =
  | { ok: true; rows: ParsedRow[]; fields: Field[] }
  | { ok: false; error: string };

/**
 * Workbook bytes → import rows. Reads the sheet as ARRAYS (header: 1) rather
 * than per-row objects: on a 40k-row list that avoids building a million
 * throwaway object keys, which is most of the parse cost.
 */
export function parseAccountsWorkbook(
  XLSX: typeof import('xlsx'),
  buf: ArrayBuffer,
  onProgress?: (rowsDone: number) => void
): ParseResult {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { ok: false, error: 'That file has no sheets.' };
  trimSheetRange(XLSX, sheet);

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });
  if (grid.length < 2) return { ok: false, error: 'That file has no data rows.' };

  // Header row → the column indexes we care about. First match for a field
  // wins, so a stray second "City" column can't overwrite the real one.
  const headerRow = (grid[0] ?? []).map((h) => (h == null ? '' : String(h)));
  const columns: Array<{ index: number; field: Field }> = [];
  const taken = new Set<Field>();
  headerRow.forEach((header, index) => {
    const field = matchField(header);
    if (field && !taken.has(field)) {
      taken.add(field);
      columns.push({ index, field });
    }
  });
  if (columns.length === 0) {
    return {
      ok: false,
      error: 'Could not recognize any columns (name, address, city, etc.). Check the header row.',
    };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];
    const row: ParsedRow = {};
    for (const { index, field } of columns) {
      const v = cells[index];
      row[field] = v == null ? '' : String(v).trim();
    }
    // Fold the separate 4-digit column into the ZIP; it is never stored on its
    // own (the accounts table has no such column).
    if (row.zip || row.zip4) row.zip = joinZip(row.zip, row.zip4);
    delete row.zip4;
    if (row.first_name || row.last_name || row.company || row.address_1) rows.push(row);
    if (onProgress && i % 2000 === 0) onProgress(i);
  }

  return { ok: true, rows, fields: columns.map((c) => c.field) };
}
