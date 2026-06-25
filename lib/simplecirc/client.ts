import 'server-only';

/**
 * SimpleCirc API v1.2 client (server-only). Pushes a NEW paid web subscriber
 * onto the paid list in SimpleCirc so they flow into print distribution /
 * mailing labels.
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
