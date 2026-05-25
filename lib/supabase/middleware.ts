import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware-specific Supabase client. Runs on every request (per
 * middleware.ts at repo root) to refresh the auth session cookies so
 * server components never read stale tokens.
 *
 * Without this, a journalist who lets their tab idle past the access-
 * token TTL (1 hour by default) gets bounced to /signin on their next
 * request — even though they have a valid refresh token. With it, the
 * token gets transparently refreshed and the request proceeds.
 *
 * Mutates the response cookies in place; returns the response so the
 * middleware handler can pass it through.
 */
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Write to both the request (so downstream code in this same
          // request sees the fresh cookie) and the response (so the
          // browser keeps it for the next request).
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  return { supabase, response };
}
