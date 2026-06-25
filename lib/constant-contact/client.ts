import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Constant Contact API v3 client (server-only). Pushes Email-Briefings sign-ups
 * to a CC contact list.
 *
 * Auth = OAuth2. App credentials live in env; the rotating user tokens live in
 * the constant_contact_oauth table (migration 019) and are refreshed + re-saved
 * on demand. One-time connect happens via /api/constant-contact/connect.
 *
 *   CONSTANT_CONTACT_CLIENT_ID      — the CC app's API key
 *   CONSTANT_CONTACT_CLIENT_SECRET  — the CC app's secret
 *   CONSTANT_CONTACT_LIST_ID        — the target list's UUID
 *
 * Graceful degrade: if app env vars are missing, isConstantContactConfigured()
 * is false and the sign-up action reports "not connected" instead of crashing.
 */

const AUTHZ_BASE = 'https://authz.constantcontact.com/oauth2/default/v1';
const API_BASE = 'https://api.cc.email/v3';
export const CC_SCOPE = 'contact_data offline_access';

function appCreds() {
  const clientId = process.env.CONSTANT_CONTACT_CLIENT_ID;
  const clientSecret = process.env.CONSTANT_CONTACT_CLIENT_SECRET;
  const listId = process.env.CONSTANT_CONTACT_LIST_ID;
  if (!clientId || !clientSecret || !listId) return null;
  return { clientId, clientSecret, listId };
}

/** True once the CC app credentials + list id are set in env. (Doesn't check
 *  whether the OAuth connect has been completed — that's a separate state.) */
export function isConstantContactConfigured(): boolean {
  return appCreds() !== null;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/** The redirect URI registered in the CC app — also used in token exchange. */
export function ccRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/constant-contact/callback`;
}

/** Browser authorize URL to start the one-time connect. */
export function ccAuthorizeUrl(origin: string, state: string): string {
  const creds = appCreds();
  if (!creds) throw new Error('Constant Contact is not configured.');
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: ccRedirectUri(origin),
    response_type: 'code',
    scope: CC_SCOPE,
    state,
  });
  return `${AUTHZ_BASE}/authorize?${params.toString()}`;
}

type TokenRow = { access_token: string | null; refresh_token: string | null; expires_at: string | null };

async function readTokenRow(): Promise<TokenRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('constant_contact_oauth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 1)
    .maybeSingle();
  return (data as TokenRow | null) ?? null;
}

async function saveTokens(access: string, refresh: string, expiresInSec: number): Promise<void> {
  const admin = createAdminClient();
  const expires_at = new Date(Date.now() + expiresInSec * 1000).toISOString();
  await admin
    .from('constant_contact_oauth')
    .upsert({ id: 1, access_token: access, refresh_token: refresh, expires_at, updated_at: new Date().toISOString() });
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

/** Exchange an authorization code for tokens (used by the OAuth callback) and
 *  persist them. */
export async function ccExchangeCode(code: string, origin: string): Promise<void> {
  const creds = appCreds();
  if (!creds) throw new Error('Constant Contact is not configured.');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: ccRedirectUri(origin),
  });
  const res = await fetch(`${AUTHZ_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(creds.clientId, creds.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Constant Contact token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as TokenResponse;
  await saveTokens(json.access_token, json.refresh_token, json.expires_in);
}

/** True once the one-time OAuth connect has stored a refresh token. */
export async function isConstantContactConnected(): Promise<boolean> {
  if (!isConstantContactConfigured()) return false;
  const row = await readTokenRow();
  return Boolean(row?.refresh_token);
}

/** Get a valid access token, refreshing (and persisting the rotated refresh
 *  token) when expired. Throws if not connected. */
async function getAccessToken(): Promise<string> {
  const creds = appCreds();
  if (!creds) throw new Error('Constant Contact is not configured.');
  const row = await readTokenRow();
  if (!row?.refresh_token) throw new Error('Constant Contact is not connected yet.');

  const stillValid =
    row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 120_000;
  if (stillValid) return row.access_token as string;

  const res = await fetch(`${AUTHZ_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(creds.clientId, creds.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
  });
  if (!res.ok) {
    throw new Error(`Constant Contact token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as TokenResponse;
  await saveTokens(json.access_token, json.refresh_token, json.expires_in);
  return json.access_token;
}

export type CcList = { id: string; name: string; count: number | null };

/** List the account's contact lists (id + name + member count). Used by the
 *  admin /api/constant-contact/lists helper to look up CONSTANT_CONTACT_LIST_ID. */
export async function ccListContactLists(): Promise<CcList[]> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/contact_lists?include_count=true&limit=1000`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Constant Contact list fetch failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { lists?: Array<{ list_id: string; name: string; membership_count?: number }> };
  return (json.lists ?? []).map((l) => ({ id: l.list_id, name: l.name, count: l.membership_count ?? null }));
}

export type BriefingContact = {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

/** Add (or update) a contact on the Email-Briefings list via the sign-up-form
 *  endpoint (implies opt-in consent, which is correct for a website form). */
export async function addBriefingContact(c: BriefingContact): Promise<{ ok: boolean; error?: string }> {
  const creds = appCreds();
  if (!creds) return { ok: false, error: 'not_configured' };

  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.error('[constant-contact] token', e);
    return { ok: false, error: 'not_connected' };
  }

  const hasAddress = c.street || c.city || c.state || c.zip;
  const payload: Record<string, unknown> = {
    email_address: c.email,
    list_memberships: [creds.listId],
  };
  if (c.firstName) payload.first_name = c.firstName;
  if (c.lastName) payload.last_name = c.lastName;
  if (c.phone) payload.phone_number = c.phone;
  if (hasAddress) {
    payload.street_address = {
      kind: 'home',
      street: c.street ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      postal_code: c.zip ?? '',
      country: 'US',
    };
  }

  const res = await fetch(`${API_BASE}/contacts/sign_up_form`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('[constant-contact] sign_up_form', res.status, await res.text());
    return { ok: false, error: 'cc_rejected' };
  }
  return { ok: true };
}
