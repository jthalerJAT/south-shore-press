'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AccountType, AccountStatus } from '@/lib/account-types';
import { titleCase, normalizeState, formatPhone, normalizeZip } from '@/lib/format';

const ADMIN_ROLES = ['admin', 'master admin'] as const;
const BASE = '/portal/all/accounts';

type Result = { ok: boolean; error?: string };

export type AccountInput = {
  account_type: AccountType;
  status: AccountStatus;
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  phone?: string;
  subscription_start?: string; // YYYY-MM-DD or ''
  subscription_end?: string;
  acs_keyline?: string;
};

const TYPES: AccountType[] = [
  'digital_only',
  'paid_all_access',
  'paid_yearly',
  'paid_monthly',
  'free',
  'advertiser',
  'mailer',
];

function clean(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

/** Normalize an input into a DB row. Subscription dates are preserved as passed
 *  (the form only exposes them for paid types, but imported mailers may carry a
 *  legacy expiration date we don't want to wipe on a later edit). */
function toRow(input: AccountInput) {
  return {
    account_type: input.account_type,
    status: input.status === 'expired' ? 'expired' : 'active',
    first_name: titleCase(input.first_name) || null,
    last_name: titleCase(input.last_name) || null,
    company: clean(input.company),
    address_1: titleCase(input.address_1) || null,
    address_2: titleCase(input.address_2) || null,
    city: titleCase(input.city) || null,
    state: normalizeState(input.state) || null,
    zip: normalizeZip(input.zip) || null,
    email: clean(input.email),
    phone: formatPhone(input.phone) || null,
    subscription_start: clean(input.subscription_start),
    subscription_end: clean(input.subscription_end),
    acs_keyline: clean(input.acs_keyline),
    updated_at: new Date().toISOString(),
  };
}

function validate(input: AccountInput): string | null {
  if (!TYPES.includes(input.account_type)) return 'Pick a valid account type.';
  if (!clean(input.last_name) && !clean(input.company)) {
    return 'Enter at least a last name or a company.';
  }
  return null;
}

export async function createAccount(
  input: AccountInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  await requireRole([...ADMIN_ROLES], BASE);
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .insert({ ...toRow(input), source: 'manual' })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createAccount]', error);
    return { ok: false, error: 'Could not create the account.' };
  }
  revalidatePath(BASE);
  return { ok: true, id: data.id as string };
}

export async function updateAccount(id: string, input: AccountInput): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { error } = await admin.from('accounts').update(toRow(input)).eq('id', id);
  if (error) {
    console.error('[updateAccount]', error);
    return { ok: false, error: 'Could not save the account.' };
  }

  // If this account is linked to a login, mirror the name back onto the
  // profile so the header chip + Credentials tile reflect the edit (accounts
  // is the master; profiles carries only the auth-required name mirror).
  try {
    const { data: linked } = await admin
      .from('accounts')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    const userId = (linked as { user_id: string | null } | null)?.user_id;
    if (userId) {
      const first = input.first_name?.trim() || null;
      const last = input.last_name?.trim() || null;
      const display = [first, last].filter(Boolean).join(' ') || null;
      await admin
        .from('profiles')
        .update({
          first_name: first,
          last_name: last,
          phone: input.phone?.trim() || null,
          street_address: input.address_1?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          zip_code: input.zip?.trim() || null,
          ...(display ? { display_name: display } : {}),
        })
        .eq('id', userId);
    }
  } catch (e) {
    console.error('[updateAccount] profile sync', e);
  }

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  return { ok: true };
}

/** Permanently delete accounts by id (multi-select / select-all). Hard delete —
 *  used mainly to clear stale weekly mailers. */
export async function deleteAccounts(ids: string[]): Promise<Result & { deleted?: number }> {
  await requireRole([...ADMIN_ROLES], BASE);
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return { ok: false, error: 'No accounts selected.' };

  const admin = createAdminClient();
  // Chunk to stay well under any URL/IN-list limits on large mailer purges.
  let deleted = 0;
  for (let i = 0; i < clean.length; i += 500) {
    const chunk = clean.slice(i, i + 500);
    const { error, count } = await admin
      .from('accounts')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (error) {
      console.error('[deleteAccounts]', error);
      return { ok: false, error: 'Could not delete the selected accounts.', deleted };
    }
    deleted += count ?? chunk.length;
  }
  revalidatePath(BASE);
  return { ok: true, deleted };
}

/* ------------------------------------------------------------------ *
 *  Account import (Phase 3). The client parses the Excel/CSV and posts
 *  normalized rows in chunks; the server clears (optional) and bulk-inserts
 *  them. Every row carries its own account_type so any cohort — the weekly
 *  mailer list, existing paid subscribers, free-physical, etc. — can be
 *  brought in with the correct type.
 * ------------------------------------------------------------------ */

export type ImportAccountRow = {
  account_type: AccountType;
  status?: AccountStatus;
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  phone?: string;
  acs_keyline?: string;
  account_number?: string;
  subscription_start?: string;
  subscription_end?: string;
  last_payment_date?: string;
  last_payment_amount?: string;
};

function toMoney(v: string | undefined): number | null {
  const t = (v ?? '').replace(/[^0-9.-]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/** Permanently delete every account of the given type(s) — the "Replace all"
 *  import mode (e.g. the weekly mailer list changes wholesale). Other types
 *  are untouched. */
export async function clearAccountsByType(
  types: AccountType[]
): Promise<Result & { deleted?: number }> {
  await requireRole([...ADMIN_ROLES], BASE);
  const list = Array.from(new Set(types)).filter(Boolean);
  if (list.length === 0) return { ok: true, deleted: 0 };
  const admin = createAdminClient();
  const { error, count } = await admin
    .from('accounts')
    .delete({ count: 'exact' })
    .in('account_type', list);
  if (error) {
    console.error('[clearAccountsByType]', error);
    return { ok: false, error: 'Could not clear existing accounts.' };
  }
  revalidatePath(BASE);
  return { ok: true, deleted: count ?? 0 };
}

/** Insert one chunk of imported rows. Called repeatedly by the client so a
 *  ~5,000-row import stays under the server-action body limit. */
export async function insertAccountBatch(
  rows: ImportAccountRow[]
): Promise<Result & { inserted?: number }> {
  await requireRole([...ADMIN_ROLES], BASE);
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, inserted: 0 };

  const admin = createAdminClient();
  const payload = rows.map((r) => ({
    account_type: r.account_type,
    status: r.status === 'expired' ? 'expired' : 'active',
    first_name: titleCase(r.first_name) || null,
    last_name: titleCase(r.last_name) || null,
    company: clean(r.company),
    address_1: titleCase(r.address_1) || null,
    address_2: titleCase(r.address_2) || null,
    city: titleCase(r.city) || null,
    state: normalizeState(r.state) || null,
    zip: normalizeZip(r.zip) || null,
    email: clean(r.email),
    phone: formatPhone(r.phone) || null,
    acs_keyline: clean(r.acs_keyline),
    account_number: clean(r.account_number),
    subscription_start: clean(r.subscription_start),
    subscription_end: clean(r.subscription_end),
    // Last payment: use the explicit column if present, else fall back to the
    // subscription start (the payment that began the current term).
    last_payment_date: clean(r.last_payment_date) ?? clean(r.subscription_start),
    last_payment_amount: toMoney(r.last_payment_amount),
    source: 'import',
  }));

  const { error, count } = await admin.from('accounts').insert(payload, { count: 'exact' });
  if (error) {
    console.error('[insertAccountBatch]', error);
    return { ok: false, error: 'Could not import this batch.' };
  }
  revalidatePath(BASE);
  return { ok: true, inserted: count ?? payload.length };
}

/* ------------------------------------------------------------------ *
 *  Reconcile the Account Database against the actual Supabase logins.
 *  Heals drift from testing / deleted users:
 *    1. every profile (login) gets an account row if missing
 *    2. orphaned rows (user_id NULL) re-link to a login with the same email
 *    3. leftover signup-created orphans (login deleted) are removed —
 *       imported / manual / mailer rows are never touched
 * ------------------------------------------------------------------ */

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

type AccountLinkRow = { id: string; user_id: string | null; email: string | null; source: string | null };

async function fetchAllRows<T>(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string
): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

export async function reconcileAccounts(): Promise<
  Result & { created?: number; relinked?: number; removed?: number }
> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();

  try {
    const [profiles, accounts] = await Promise.all([
      fetchAllRows<ProfileRow>(
        admin,
        'profiles',
        'id, email, first_name, last_name, phone, street_address, city, state, zip_code'
      ),
      fetchAllRows<AccountLinkRow>(admin, 'accounts', 'id, user_id, email, source'),
    ]);

    const linkedUserIds = new Set(accounts.filter((a) => a.user_id).map((a) => a.user_id));
    const orphans = accounts.filter((a) => !a.user_id);
    const orphanByEmail = new Map<string, AccountLinkRow[]>();
    for (const o of orphans) {
      const k = (o.email ?? '').trim().toLowerCase();
      if (!k) continue;
      if (!orphanByEmail.has(k)) orphanByEmail.set(k, []);
      orphanByEmail.get(k)!.push(o);
    }

    let relinked = 0;
    const relinkOwners = new Set<string>();
    const toInsert: Record<string, unknown>[] = [];

    for (const p of profiles) {
      if (linkedUserIds.has(p.id)) continue;
      const k = (p.email ?? '').trim().toLowerCase();
      const candidate = k ? orphanByEmail.get(k)?.shift() : undefined;
      if (candidate) {
        const { error } = await admin
          .from('accounts')
          .update({ user_id: p.id, updated_at: new Date().toISOString() })
          .eq('id', candidate.id);
        if (!error) {
          relinked++;
          relinkOwners.add(candidate.id);
          linkedUserIds.add(p.id);
        }
      } else {
        toInsert.push({
          account_type: 'digital_only',
          status: 'active',
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          address_1: p.street_address,
          city: p.city,
          state: p.state,
          zip: p.zip_code,
          email: p.email,
          user_id: p.id,
          source: 'signup',
        });
      }
    }

    let created = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error, count } = await admin.from('accounts').insert(chunk, { count: 'exact' });
      if (error) throw error;
      created += count ?? chunk.length;
    }

    // Remove signup-created orphans that didn't re-link (their login was
    // permanently deleted). Imported / manual / mailer rows are preserved.
    const removeIds = orphans
      .filter((o) => o.source === 'signup' && !relinkOwners.has(o.id))
      .map((o) => o.id);
    let removed = 0;
    for (let i = 0; i < removeIds.length; i += 500) {
      const chunk = removeIds.slice(i, i + 500);
      const { error, count } = await admin
        .from('accounts')
        .delete({ count: 'exact' })
        .in('id', chunk);
      if (error) throw error;
      removed += count ?? chunk.length;
    }

    revalidatePath(BASE);
    return { ok: true, created, relinked, removed };
  } catch (e) {
    console.error('[reconcileAccounts]', e);
    return { ok: false, error: 'Reconcile failed — see server logs.' };
  }
}

/** Assign account numbers to any rows imported without one (called once after
 *  an import completes). Rows that came in with a number keep it. */
export async function assignMissingAccountNumbers(): Promise<Result> {
  await requireRole([...ADMIN_ROLES], BASE);
  const admin = createAdminClient();
  const { error } = await admin.rpc('assign_missing_account_numbers');
  if (error) {
    console.error('[assignMissingAccountNumbers]', error);
    return { ok: false, error: 'Could not assign account numbers.' };
  }
  revalidatePath(BASE);
  return { ok: true };
}
