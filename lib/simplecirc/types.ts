/**
 * Shared SimpleCirc row types. Kept in a plain (non-`server-only`) module so the
 * client-side subscriber table can import the row shape while the fetching logic
 * stays server-only in `client.ts`.
 */

/** One active paid subscriber, flattened for the Subscriber View table. */
export type PaidSubscriberRow = {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  email: string;
  /** Display label — "All Access" | "Yearly" | "Monthly" | raw term name. */
  type: string;
  /** ISO date (or raw string if unparseable), null if unknown. */
  dateSubscribed: string | null;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
};

export type PaidSubscriberList = {
  ok: boolean;
  /** False when the SimpleCirc env vars are unset (graceful no-op). */
  configured: boolean;
  rows: PaidSubscriberRow[];
  error?: string;
  /**
   * First raw subscriber object as SimpleCirc returned it — included ONLY when
   * parsing produced zero rows, so the exact field names can be confirmed and
   * the mapping in `client.ts` adjusted without guessing.
   */
  rawSample?: unknown;
};
