import 'server-only';
import type { PaidSubscriberRow, PaidSubscriberList } from './types';

/**
 * SimpleCirc API v1.2 client (server-only). Pushes a NEW paid web subscriber
 * onto the paid list in SimpleCirc so they flow into print distribution /
 * mailing labels, and reads back the paid subscriber list for the Subscriber
 * View (reproducing the "Paid Subscribers" export template).
 *
 * Two-step per their API: create the subscriber, then create a paid
 * subscription term on that subscriber.
 *
 * Auth: HTTP Basic with username "Bearer", password = API token.
 * Env (all required to enable; absent = graceful no-op):
 *   SIMPLECIRC_API_TOKEN       — Account Settings → API
 *   SIMPLECIRC_PUBLICATION_ID  — from SimpleCirc's API tab
 *   SIMPLECIRC_POSTAGE_ID      — from SimpleCirc's API tab
 */
const BASE = 'https://simplecirc.com/api/v1.2';

function config() {
  const token = process.env.SIMPLECIRC_API_TOKEN;
  const publicationId = process.env.SIMPLECIRC_PUBLICATION_ID;
  const postageId = process.env.SIMPLECIRC_POSTAGE_ID;
  if (!token || !publicationId || !postageId) return null;
  return { token, publicationId, postageId };
}

export function isSimpleCircConfigured(): boolean {
  return config() !== null;
}

function authHeader(token: string): string {
  return 'Basic ' + Buffer.from(`Bearer:${token}`).toString('base64');
}

export type PaidSubscriberInput = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  email: string;
  phone?: string | null;
  /** Number of issues this term covers (weekly → 52/yr, ~4/mo). */
  issues: number;
  /** Dollars paid (from the Stripe invoice). */
  amountPaid: number;
};

/** Create the subscriber + a paid subscription term. Returns the SimpleCirc
 *  subscriber/account id on success. Graceful: returns not_configured when env
 *  is unset so the caller can skip without failing the webhook. */
export async function addPaidSubscriber(
  input: PaidSubscriberInput
): Promise<{ ok: boolean; subscriberId?: string; error?: string }> {
  const cfg = config();
  if (!cfg) return { ok: false, error: 'not_configured' };

  const name = [input.firstName, input.lastName].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
  const auth = authHeader(cfg.token);

  // 1) Create the subscriber.
  let accountId: string;
  try {
    const res = await fetch(`${BASE}/subscribers`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || input.email,
        email: input.email,
        company: input.company ?? undefined,
        address_1: input.address1 ?? undefined,
        address_2: input.address2 ?? undefined,
        city: input.city ?? undefined,
        state: input.state ?? undefined,
        zipcode: input.zip ?? undefined,
        country: 'US',
        phone: input.phone ?? undefined,
      }),
    });
    if (!res.ok) {
      console.error('[simplecirc] create subscriber', res.status, await res.text());
      return { ok: false, error: 'subscriber_create_failed' };
    }
    const j = (await res.json()) as { account_id?: string | number; id?: string | number; subscriber?: { account_id?: string | number } };
    const id = j.account_id ?? j.id ?? j.subscriber?.account_id;
    if (id == null) return { ok: false, error: 'no_account_id' };
    accountId = String(id);
  } catch (e) {
    console.error('[simplecirc] create subscriber threw', e);
    return { ok: false, error: 'network' };
  }

  // 2) Create the paid subscription term.
  try {
    const res = await fetch(`${BASE}/subscribers/${accountId}/subscriptions`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publication_id: cfg.publicationId,
        postage_id: cfg.postageId,
        issues_purchased: input.issues,
        amount_paid: input.amountPaid,
        amount_due: 0,
      }),
    });
    if (!res.ok) {
      console.error('[simplecirc] create subscription', res.status, await res.text());
      // Subscriber exists but term failed — surface the id so it can be retried.
      return { ok: false, subscriberId: accountId, error: 'subscription_create_failed' };
    }
  } catch (e) {
    console.error('[simplecirc] create subscription threw', e);
    return { ok: false, subscriberId: accountId, error: 'network' };
  }

  return { ok: true, subscriberId: accountId };
}

/* ------------------------------------------------------------------ *
 *  Subscriber View — reproduce the "Paid Subscribers" export template.
 *
 *  SimpleCirc has no API to run a saved export template, so we pull the
 *  subscriber list and rebuild the same output: one row per subscription,
 *  the most-recent order (`last_order`) for the payment fields, filtered to
 *  amount paid ≠ 0. Field paths follow the documented v1.2 shape:
 *    subscriber: { account_id, first_name, last_name, email,
 *                  address: { address_1, city, state, zipcode, ... },
 *                  subscriptions: [ { subscription_id, expiration_date,
 *                     status, publication_name, last_order: {
 *                       amount_paid, amount_due, order_date_time, issues } } ] }
 *  Extractors read candidate keys so a naming difference is a one-line fix;
 *  `rawSample` (surfaced when zero rows parse) reveals the true shape.
 * ------------------------------------------------------------------ */

type RawObj = Record<string, unknown>;

/** First non-empty value among candidate keys. */
function pick(o: RawObj | undefined, keys: string[]): unknown {
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

function asObj(v: unknown): RawObj | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as RawObj) : undefined;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Parse a money value that may arrive as number or "$50.00". */
function toAmount(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? null : n;
}

/** Normalize a date to ISO; fall back to the raw string; null if empty. */
function toISO(v: unknown): string | null {
  if (v == null || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function splitName(s: RawObj): { first: string; last: string } {
  const first = str(pick(s, ['first_name', 'firstname', 'fname', 'given_name']));
  const last = str(pick(s, ['last_name', 'lastname', 'lname', 'surname', 'family_name']));
  if (first || last) return { first, last };
  const name = str(pick(s, ['name', 'full_name', 'display_name']));
  if (!name) return { first: '', last: '' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** The address block is a nested object on the subscriber; fall back to any
 *  flat fields if an account stores them at the top level. */
function addressPart(s: RawObj, keys: string[]): string {
  const addr = asObj(pick(s, ['address', 'mailing_address', 'primary_address']));
  return str(pick(addr, keys)) || str(pick(s, keys));
}

/** Nested subscription records, normalized to an array. */
function subsOf(s: RawObj): RawObj[] {
  const arr = pick(s, ['subscriptions', 'subscription', 'terms']);
  if (Array.isArray(arr)) return arr as RawObj[];
  const one = asObj(arr);
  return one ? [one] : [];
}

/** "Subscription Type Name" — New / Renewal / Gift / plan name. */
function typeName(sub: RawObj, order: RawObj | undefined): string {
  return str(
    pick(order, ['type', 'order_type', 'type_name', 'subscription_type']) ??
      pick(sub, ['type', 'type_name', 'subscription_type', 'subscription_type_name', 'plan', 'publication_name', 'name'])
  );
}

/** Pull the subscriber array out of whatever envelope SimpleCirc returns. */
function extractArray(j: unknown): RawObj[] {
  if (Array.isArray(j)) return j as RawObj[];
  const o = asObj(j);
  if (o) {
    for (const k of ['subscribers', 'data', 'results', 'records', 'items']) {
      const v = o[k];
      if (Array.isArray(v)) return v as RawObj[];
    }
  }
  return [];
}

/** Page through /subscribers using SimpleCirc's cursor pagination
 *  (limit ≤ 100, `starting_after` = last account id). Stops on a short/empty
 *  page or when the cursor stops advancing. Capped as a runaway backstop. */
async function fetchAllSubscribers(auth: string): Promise<RawObj[]> {
  const out: RawObj[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let i = 0; i < 500; i++) {
    const url = `${BASE}/subscribers?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (!res.ok) {
      if (i === 0) throw new Error(`SimpleCirc responded ${res.status}`);
      break;
    }
    const batch = extractArray(await res.json());
    if (!batch.length) break;

    let added = 0;
    let lastId = '';
    for (const s of batch) {
      const id = str(pick(s, ['account_id', 'id', 'subscriber_id']));
      lastId = id || lastId;
      const key = id || JSON.stringify(s);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
        added++;
      }
    }
    if (batch.length < 100 || added === 0 || !lastId || lastId === cursor) break;
    cursor = lastId;
  }
  return out;
}

/** Paid subscriptions for the Subscriber View table — reproduces the SimpleCirc
 *  "Paid Subscribers" export template. Graceful no-op ({configured:false}) when
 *  the SimpleCirc env is unset. */
export async function listPaidSubscribers(): Promise<PaidSubscriberList> {
  const cfg = config();
  if (!cfg) return { ok: false, configured: false, rows: [], totalPaid: 0 };

  let raw: RawObj[];
  try {
    raw = await fetchAllSubscribers(authHeader(cfg.token));
  } catch (e) {
    console.error('[simplecirc] listPaidSubscribers', e);
    return { ok: false, configured: true, rows: [], totalPaid: 0, error: 'Could not reach SimpleCirc.' };
  }

  const rows: PaidSubscriberRow[] = [];
  for (const s of raw) {
    const accountId = str(pick(s, ['account_id', 'id', 'subscriber_id']));
    const { first, last } = splitName(s);
    const email = str(pick(s, ['email', 'email_address']));
    const address1 = addressPart(s, ['address_1', 'address1', 'address', 'street', 'street_address', 'addr1']);
    const city = addressPart(s, ['city', 'town']);
    const state = addressPart(s, ['state', 'province', 'region']);

    // One row per subscription with a paid most-recent order (amount ≠ 0) —
    // exactly the export template's grouping + "Payment Amount Paid ≠ 0" filter.
    for (const sub of subsOf(s)) {
      const order = asObj(pick(sub, ['last_order', 'latest_order', 'order', 'last_payment']));
      const amountPaid = toAmount(
        pick(order, ['amount_paid', 'amount', 'total', 'price']) ??
          pick(sub, ['amount_paid', 'amount', 'last_payment_amount'])
      );
      if (amountPaid == null || amountPaid === 0) continue;

      rows.push({
        key: `${accountId}:${str(pick(sub, ['subscription_id', 'id'])) || rows.length}`,
        accountId,
        firstName: first,
        lastName: last,
        address1,
        city,
        state,
        email,
        typeName: typeName(sub, order),
        amountPaid,
        startDate: toISO(
          pick(order, ['order_date_time', 'order_date', 'date', 'paid_date', 'created_at']) ??
            pick(sub, ['start_date', 'started_at', 'subscribe_date'])
        ),
        expireDate: toISO(
          pick(sub, ['expiration_date', 'expiration', 'expires', 'expire_date', 'end_date', 'paid_through'])
        ),
      });
    }
  }

  const totalPaid = rows.reduce((sum, r) => sum + (r.amountPaid ?? 0), 0);

  // Zero rows while records exist → the field mapping missed. Surface one raw
  // record so the candidate-key lists above can be adjusted to the real shape.
  const rawSample = rows.length === 0 && raw.length ? raw[0] : undefined;
  return { ok: true, configured: true, rows, totalPaid, rawSample };
}
