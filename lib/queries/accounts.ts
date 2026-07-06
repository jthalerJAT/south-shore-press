import { createClient } from '@/lib/supabase/server';
import { ACCOUNT_COLUMNS, type Account } from '@/lib/account-types';

/**
 * Server-side Account Database queries (migration 023). Types + constants live
 * in `@/lib/account-types` (client-safe); this module holds the reads that need
 * the server Supabase client. Admin-only via RLS.
 */

// Re-export the shared types/constants so existing server imports keep working.
export * from '@/lib/account-types';

/**
 * Every account, ordered by last name. Pages past Supabase's 1,000-row default
 * cap so the full list (~5,000 with the mailer list) comes back in one call.
 */
export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient();
  const all: Account[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_COLUMNS)
      .order('last_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[getAccounts]', error);
      break;
    }
    const batch = (data ?? []) as unknown as Account[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

/** A single account by id. */
export async function getAccount(id: string): Promise<Account | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getAccount]', error);
    return null;
  }
  return (data ?? null) as unknown as Account | null;
}
