'use client';

import { useEffect } from 'react';

/**
 * Cloudflare Turnstile bot check — shared by every auth form (sign in,
 * sign up, forgot password). Supabase's CAPTCHA protection enforces a
 * token on ALL auth endpoints, so every form that hits one must render
 * this and its server action must forward the `cf-turnstile-response`
 * value as `captchaToken` (2026-09-17: sign-in was missed in the original
 * signup-only rollout and locked everyone out once sessions expired).
 *
 * Renders nothing when no site key is configured — pass the key from a
 * server component reading the RUNTIME env (see /signup), not through
 * build-time NEXT_PUBLIC inlining, so Sensitive Vercel vars work.
 * Turnstile auto-renders `.cf-turnstile` elements once its script loads
 * and injects a hidden `cf-turnstile-response` input into the form.
 */
export function TurnstileWidget({ siteKey }: { siteKey?: string | null }) {
  const key = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!key) return;
    if (document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile"]')) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }, [key]);
  if (!key) return null;
  return <div className="cf-turnstile" data-sitekey={key} />;
}
