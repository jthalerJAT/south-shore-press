/**
 * Client-safe Account Database types + constants. Kept separate from
 * `lib/queries/accounts.ts` (which imports the server Supabase client) so client
 * components can use the enums/labels without pulling `next/headers` into the
 * browser bundle.
 */

export type AccountType =
  | 'digital_only'
  | 'paid_all_access'
  | 'paid_yearly'
  | 'paid_monthly'
  | 'free'
  | 'advertiser'
  | 'mailer';

export type AccountStatus = 'active' | 'expired';

export type Account = {
  id: string;
  account_type: AccountType;
  status: AccountStatus;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
  phone: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  acs_keyline: string | null;
  account_number: string | null;
  user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  has_payment_method: boolean;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

/** Display metadata for each account type. `paid` drives the subscription
 *  start/end fields and the digital-access implication. */
export const ACCOUNT_TYPES: Array<{ value: AccountType; label: string; paid: boolean }> = [
  { value: 'digital_only', label: 'Digital Only (free)', paid: false },
  { value: 'paid_all_access', label: 'Paid — All Access', paid: true },
  { value: 'paid_yearly', label: 'Paid — Yearly (physical)', paid: true },
  { value: 'paid_monthly', label: 'Paid — Monthly (physical)', paid: true },
  { value: 'free', label: 'Free (physical)', paid: false },
  { value: 'advertiser', label: 'Advertiser', paid: false },
  { value: 'mailer', label: 'Weekly Mailer', paid: false },
];

export const ACCOUNT_TYPE_LABEL = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.value, t.label])
) as Record<AccountType, string>;

export const PAID_ACCOUNT_TYPES: AccountType[] = ACCOUNT_TYPES.filter((t) => t.paid).map(
  (t) => t.value
);

export function isPaidAccountType(t: AccountType): boolean {
  return PAID_ACCOUNT_TYPES.includes(t);
}

export const ACCOUNT_COLUMNS =
  'id, account_type, status, first_name, last_name, company, address_1, address_2, ' +
  'city, state, zip, email, phone, subscription_start, subscription_end, ' +
  'last_payment_date, last_payment_amount, acs_keyline, ' +
  'account_number, user_id, stripe_customer_id, stripe_subscription_id, ' +
  'has_payment_method, payment_method_last4, payment_method_brand, source, ' +
  'created_at, updated_at';
