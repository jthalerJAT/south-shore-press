/** Server-side read of the Turnstile site key from the RUNTIME env (works
 *  for Sensitive Vercel vars that build-time NEXT_PUBLIC_ inlining can't
 *  see). Plain module — NOT 'use client' — so server components can call it
 *  (a client-module export would arrive as a client reference, not a
 *  function: the build-breaking pitfall hit 2026-09-16). */
export function turnstileSiteKeyFromEnv(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? process.env.TURNSTILE_SITE_KEY ?? null;
}
