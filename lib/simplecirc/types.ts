/**
 * Shared SimpleCirc row types. Kept in a plain (non-`server-only`) module so the
 * client-side subscriber table can import the row shape while the fetching logic
 * stays server-only in `client.ts`.
 */

/**
 * One paid subscription row — mirrors the "Paid Subscribers" export template in
 * SimpleCirc (one record per subscription, most-recent order for the payment
 * fields, filtered to amount paid ≠ 0).
 */
export type PaidSubscriberRow = {
  /** Stable unique key for React (account id + subscription id). */
  key: string;
  accountId: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  email: string;
  /** "Subscription Type Name" — New / Renewal / Gift / plan name. */
  typeName: string;
  /** Payment Amount Paid (most recent order). */
  amountPaid: number | null;
  /** Payment Start Date (most recent order date), ISO or raw string. */
  startDate: string | null;
  /** Payment Expire Date (subscription expiration), ISO or raw string. */
  expireDate: string | null;
};

export type PaidSubscriberList = {
  ok: boolean;
  /** False when the SimpleCirc env vars are unset (graceful no-op). */
  configured: boolean;
  rows: PaidSubscriberRow[];
  /** Sum of amountPaid across rows (matches the export's total row). */
  totalPaid: number;
  error?: string;
  /**
   * First raw subscriber object as SimpleCirc returned it — included ONLY when
   * parsing produced zero rows, so the exact field names can be confirmed and
   * the mapping in `client.ts` adjusted without guessing.
   */
  rawSample?: unknown;
};
