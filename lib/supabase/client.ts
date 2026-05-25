'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for Client Components that need direct
 * subscription / interaction with Supabase (e.g. realtime listeners,
 * client-uploaded files). Prefer the server client + Server Actions for
 * data mutations whenever possible — keeps secrets server-side and avoids
 * the auth-deadlock class of bugs v1 had to work around.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
