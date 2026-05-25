import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

/**
 * Runs on every matching request to refresh the Supabase auth session.
 * The `supabase.auth.getUser()` call triggers cookie refresh under the
 * hood when the access token is expired but the refresh token is valid.
 *
 * We don't enforce auth here — that's done per-route in the protected
 * /portal layout. Middleware just keeps cookies fresh.
 *
 * Matcher excludes static assets, _next internals, image optimizer,
 * favicon, and the sitemap/robots routes so we don't burn CPU on them.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Touch the session — this is the call that refreshes tokens when
  // needed. Result is discarded.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml, news-sitemap.xml
     * - public files: anything with a file extension
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|news-sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico)$).*)',
  ],
};
