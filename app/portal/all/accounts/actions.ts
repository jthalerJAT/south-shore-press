'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AccountType, AccountStatus } from '@/lib/account-types';
import { isPaidAccountType } from '@/lib/account-types';

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

/** Normalize an input into a DB row. Subscription dates are kept only for paid
 *  types (they're meaningless for mailers / free / digital). */
function toRow(input: AccountInput) {
  const paid = isPaidAccountType(input.account_type);
  return {
    account_type: input.account_type,
    status: input.status === 'expired' ? 'expired' : 'active',
    first_name: clean(input.first_name),
    last_name: clean(input.last_name),
    company: clean(input.company),
    address_1: clean(input.address_1),
    address_2: clean(input.address_2),
    city: clean(input.city),
    state: clean(input.state),
    zip: clean(input.zip),
    email: clean(input.email),
    phone: clean(input.phone),
    subscription_start: paid ? clean(input.subscription_start) : null,
    subscription_end: paid ? clean(input.subscription_end) : null,
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
