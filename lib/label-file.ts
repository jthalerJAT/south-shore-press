import type { Account } from '@/lib/account-types';

/**
 * Weekly mailing "label file" — the CSV format SimpleCirc produced and the
 * printer consumes to make mailing labels. Reproduced here from the internal
 * Account Database so we can generate it on demand. Client-safe (no server
 * imports) so the export can run entirely in the browser from the loaded rows.
 */

export const PUBLICATION_NAME = 'The South Shore Press';

export const LABEL_FILE_HEADERS = [
  'Subscription Expiration Date',
  'Publication Name',
  'ACS Keyline',
  'Subscriber Account ID',
  'Subscriber First Name',
  'Subscriber Last Name',
  'Subscriber Company',
  'Subscriber Address 1',
  'Subscriber Address 2',
  'Subscriber City',
  'Subscriber State',
  'Subscriber Zipcode',
] as const;

/** Quote a CSV field only when it contains a comma, quote, or newline. */
function csvField(v: string | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function accountToLabelRow(a: Account): string[] {
  return [
    a.subscription_end ?? '',
    PUBLICATION_NAME,
    a.acs_keyline ?? '',
    a.account_number ?? '',
    a.first_name ?? '',
    a.last_name ?? '',
    a.company ?? '',
    a.address_1 ?? '',
    a.address_2 ?? '',
    a.city ?? '',
    a.state ?? '',
    a.zip ?? '',
  ];
}

/** Build the full label-file CSV (CRLF line endings, standard for CSV). */
export function toLabelFileCsv(accounts: Account[]): string {
  const lines = [LABEL_FILE_HEADERS.map(csvField).join(',')];
  for (const a of accounts) lines.push(accountToLabelRow(a).map(csvField).join(','));
  return lines.join('\r\n');
}
