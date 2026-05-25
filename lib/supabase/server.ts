import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in:
 *   - React Server Components
 *   - Route Handlers (`app/api/*`)
 *   - Server Actions
 *
 * Auth state is read from / written to the request cookies, which Next.js
 * forwards on every server render. This is the path that sidesteps the
 * navigator.locks + auth deadlock issues we hit on v1 — server-side has
 * no shared lock to fight over.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In a pure RSC (no mutation), Next.js disallows cookie writes;
          // the SSR helpers call set() during token refresh. Swallow the
          // error — middleware (added later) will refresh the cookies on
          // the next request.
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* noop — see comment above */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            /* noop */
          }
        },
      },
    }
  );
}
