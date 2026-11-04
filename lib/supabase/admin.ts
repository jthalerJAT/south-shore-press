import 'server-only';
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * The Stripe webhook has no user session (no cookies), so the normal
 * `@supabase/ssr` server client can't satisfy the self-row RLS policies
 * when it writes subscription status back to `profiles` /
 * `subscription_orders`. This client uses the service-role key, which
 * bypasses RLS entirely.
 *
 * The `import 'server-only'` guard makes the build fail loudly if this
 * module is ever pulled into a client bundle — the service-role key must
 * never reach the browser. Only the webhook route imports this.
 */

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  cached = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      // Never let Next's Data Cache answer a service-role read. These reads
      // back the press export and the Stripe webhook: both must see the row
      // as it is NOW, not as it was when the cache entry was written
      // (press export printed a stale page 3, 2026-11-04).
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return cached;
}

/** True if the service-role key is configured (the webhook needs it). */
export function isAdminClientEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
