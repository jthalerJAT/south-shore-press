import 'server-only';
import type { PaidSubscriberRow, PaidSubscriberList } from './types';

/**
 * SimpleCirc API v1.2 client (server-only). Pushes a NEW paid web subscriber
 * onto the paid list in SimpleCirc so they flow into print distribution /
 * mailing labels, and reads back the active paid list for the Subscriber View.
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
 *  Subscriber View — read the active paid list from SimpleCirc.
 *
 *  SimpleCirc's exact response field names for the subscriber list and its
 *  nested subscription/payment data aren't publicly pinned, so every extractor
 *  below reads a set of candidate keys and normalizes. If a real response uses
 *  different names, `rawSample` (surfaced when zero rows parse) shows the exact
 *  shape and the candidate lists here become the single place to adjust.
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

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
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

/** Nested subscription/term records on a subscriber, normalized to an array. */
function subsOf(s: RawObj): RawObj[] {
  const arr = pick(s, ['subscriptions', 'subscription', 'terms', 'orders']);
  if (Array.isArray(arr)) return arr as RawObj[];
  if (arr && typeof arr === 'object') return [arr as RawObj];
  return [];
}

/** A subscription is "active" if its status says so, or it hasn't expired. */
function isActiveSub(sub: RawObj): boolean {
  const status = str(pick(sub, ['status', 'state', 'subscription_status'])).toLowerCase();
  if (status) {
    if (/(active|current|ongoing|paid|live)/.test(status)) return true;
    if (/(expired|cancel|inactive|lapsed|stopped|ended)/.test(status)) return false;
  }
  const exp = pick(sub, [
    'expiration', 'expires', 'expire_date', 'expiration_date', 'end_date', 'paid_through', 'expires_on',
  ]);
  if (exp) {
    const d = new Date(String(exp));
    if (!Number.isNaN(d.getTime())) return d.getTime() >= Date.now();
  }
  // Unknown → assume active so a missing status field doesn't silently drop
  // real subscribers from the count.
  return true;
}

/** Exclude the several-thousand free/complimentary recipients — Subscriber
 *  View is the *paid* list only. */
function isPaidSub(sub: RawObj): boolean {
  const name = str(
    pick(sub, ['plan', 'plan_name', 'term', 'term_name', 'type', 'subscription_type', 'offer', 'name'])
  ).toLowerCase();
  if (/(free|comp\b|complimentary|courtesy|trade|gratis|promo)/.test(name)) return false;
  const amt = toAmount(pick(sub, ['amount_paid', 'amount', 'price', 'total', 'last_payment_amount']));
  if (amt != null) return amt > 0;
  // No amount info and not obviously free → treat as paid (this is the paid list).
  return true;
}

function subStart(sub: RawObj): number {
  const v = pick(sub, ['start_date', 'started_at', 'subscribe_date', 'date_started', 'order_date', 'created_at', 'created']);
  const d = v ? new Date(String(v)) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
}

function deriveType(sub: RawObj): string {
  const name = str(
    pick(sub, ['plan', 'plan_name', 'term', 'term_name', 'type', 'subscription_type', 'offer', 'name'])
  ).toLowerCase();
  if (/all.?access/.test(name)) return 'All Access';
  if (/month/.test(name)) return 'Monthly';
  if (/(year|annual|52)/.test(name)) return 'Yearly';

  const amount = toAmount(pick(sub, ['amount_paid', 'amount', 'price', 'total']));
  if (amount != null) {
    if (amount >= 900) return 'All Access';
    if (amount >= 250) return 'Yearly';
    if (amount > 0) return 'Monthly';
  }
  const issues = Number(pick(sub, ['issues_purchased', 'issues', 'quantity']) ?? 0);
  if (issues) {
    if (issues >= 40) return 'Yearly';
    if (issues <= 6) return 'Monthly';
  }
  return name ? titleCase(name) : 'Paid';
}

/** Most recent payment across the subscriber's subscriptions + any top-level
 *  transactions/payments array. */
function lastPayment(s: RawObj, subs: RawObj[]): { date: string | null; amount: number | null } {
  const candidates: Array<{ t: number; date: string | null; amount: number | null }> = [];

  const consider = (dateV: unknown, amtV: unknown) => {
    const iso = toISO(dateV);
    const amount = toAmount(amtV);
    if (iso == null && amount == null) return;
    const t = iso ? new Date(iso).getTime() : 0;
    candidates.push({ t: Number.isNaN(t) ? 0 : t, date: iso, amount });
  };

  for (const sub of subs) {
    consider(
      pick(sub, ['last_payment_date', 'last_paid_date', 'paid_date', 'payment_date']),
      pick(sub, ['last_payment_amount', 'amount_paid', 'last_amount', 'amount', 'price'])
    );
    const pays = pick(sub, ['payments', 'transactions']);
    if (Array.isArray(pays)) {
      for (const p of pays as RawObj[]) {
        consider(
          pick(p, ['date', 'paid_date', 'payment_date', 'created_at', 'created']),
          pick(p, ['amount', 'amount_paid', 'total', 'price'])
        );
      }
    }
  }
  const topPays = pick(s, ['payments', 'transactions']);
  if (Array.isArray(topPays)) {
    for (const p of topPays as RawObj[]) {
      consider(
        pick(p, ['date', 'paid_date', 'payment_date', 'created_at', 'created']),
        pick(p, ['amount', 'amount_paid', 'total', 'price'])
      );
    }
  }

  if (!candidates.length) return { date: null, amount: null };
  candidates.sort((a, b) => b.t - a.t);
  return { date: candidates[0].date, amount: candidates[0].amount };
}

/** Pull the subscriber array out of whatever envelope SimpleCirc returns. */
function extractArray(j: unknown): RawObj[] {
  if (Array.isArray(j)) return j as RawObj[];
  if (j && typeof j === 'object') {
    for (const k of ['subscribers', 'data', 'results', 'records', 'items']) {
      const v = (j as RawObj)[k];
      if (Array.isArray(v)) return v as RawObj[];
    }
  }
  return [];
}

/** Page through /subscribers, deduped by account id. Stops when a page adds
 *  no new records (handles both proper pagination and endpoints that ignore
 *  the page param). Capped so a misbehaving endpoint can't loop forever. */
async function fetchAllSubscribers(auth: string): Promise<RawObj[]> {
  const seen = new Map<string, RawObj>();
  for (let page = 1; page <= 500; page++) {
    const res = await fetch(`${BASE}/subscribers?page=${page}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    if (!res.ok) {
      if (page === 1) throw new Error(`SimpleCirc responded ${res.status}`);
      break;
    }
    const batch = extractArray(await res.json());
    if (!batch.length) break;
    let added = 0;
    for (const s of batch) {
      const id = str(pick(s, ['account_id', 'id', 'subscriber_id']));
      const key = id || JSON.stringify(s);
      if (!seen.has(key)) {
        seen.set(key, s);
        added++;
      }
    }
    if (added === 0) break; // endpoint ignored the page param → avoid an infinite loop
  }
  return [...seen.values()];
}

/** Active paid subscribers for the Subscriber View table. Graceful no-op
 *  ({configured:false}) when the SimpleCirc env is unset. */
export async function listPaidSubscribers(): Promise<PaidSubscriberList> {
  const cfg = config();
  if (!cfg) return { ok: false, configured: false, rows: [] };

  let raw: RawObj[];
  try {
    raw = await fetchAllSubscribers(authHeader(cfg.token));
  } catch (e) {
    console.error('[simplecirc] listPaidSubscribers', e);
    return { ok: false, configured: true, rows: [], error: 'Could not reach SimpleCirc.' };
  }

  const rows: PaidSubscriberRow[] = [];
  for (const s of raw) {
    const subs = subsOf(s);
    const active = subs.filter((x) => isActiveSub(x) && isPaidSub(x));
    if (!active.length) continue; // not an active paid subscriber

    const primary = active.slice().sort((a, b) => subStart(b) - subStart(a))[0];
    const earliestStart = active.reduce<number>((min, x) => {
      const t = subStart(x);
      return t && (min === 0 || t < min) ? t : min;
    }, 0);
    const { date: payDate, amount: payAmount } = lastPayment(s, active);
    const { first, last } = splitName(s);

    rows.push({
      id: str(pick(s, ['account_id', 'id', 'subscriber_id'])) || String(rows.length + 1),
      firstName: first,
      lastName: last,
      street: str(pick(s, ['address_1', 'address1', 'address', 'street', 'street_address', 'addr1'])),
      city: str(pick(s, ['city', 'town'])),
      state: str(pick(s, ['state', 'province', 'region'])),
      email: str(pick(s, ['email', 'email_address'])),
      type: deriveType(primary),
      dateSubscribed: earliestStart
        ? new Date(earliestStart).toISOString()
        : toISO(pick(s, ['date_added', 'created_at', 'signup_date', 'created'])),
      lastPaymentDate: payDate,
      lastPaymentAmount: payAmount,
    });
  }

  // Zero rows while records exist → the field mapping missed. Surface one raw
  // record so the candidate-key lists above can be adjusted to the real shape.
  const rawSample = rows.length === 0 && raw.length ? raw[0] : undefined;
  return { ok: true, configured: true, rows, rawSample };
}
