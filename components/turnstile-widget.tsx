'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile bot check — shared by every auth form (sign in,
 * sign up, forgot password). Supabase's CAPTCHA protection enforces a
 * token on ALL auth endpoints, so every form that hits one must render
 * this and its server action must forward the `cf-turnstile-response`
 * value as `captchaToken` (2026-09-17: sign-in was missed in the original
 * signup-only rollout and locked everyone out once sessions expired).
 *
 * Rendering is EXPLICIT, not implicit (2026-09-30): the implicit
 * `.cf-turnstile` auto-scan only runs when the script first loads, so a
 * widget mounted after a client-side navigation never rendered and the
 * form silently submitted with no token — Supabase rejected /recover and
 * the user saw a fake "email sent". Explicit render also gives us the
 * token callback, which forms use to keep their submit button disabled
 * until the challenge has actually produced a token (`onToken`).
 *
 * Renders nothing when no site key is configured — pass the key from a
 * server component reading the RUNTIME env (see /signup), not through
 * build-time NEXT_PUBLIC inlining, so Sensitive Vercel vars work.
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __sspTurnstileOnload?: () => void;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__sspTurnstileOnload';

const readyCallbacks = new Set<() => void>();

function whenTurnstileReady(cb: () => void) {
  if (window.turnstile) {
    cb();
    return;
  }
  readyCallbacks.add(cb);
  window.__sspTurnstileOnload = () => {
    readyCallbacks.forEach((fn) => fn());
    readyCallbacks.clear();
  };
  if (!document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile"]')) {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    document.head.appendChild(s);
  }
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey?: string | null;
  /** Called with the token when the challenge completes, and with null when
   *  it expires or errors. Forms use this to gate their submit button. */
  onToken?: (token: string | null) => void;
}) {
  const key = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const holderRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    const holder = holderRef.current;
    if (!key || !holder) return;
    let widgetId: string | null = null;
    let cancelled = false;

    whenTurnstileReady(() => {
      if (cancelled || !window.turnstile) return;
      holder.innerHTML = ''; // strict-mode double-mount guard
      widgetId = window.turnstile.render(holder, {
        sitekey: key,
        callback: (token: string) => onTokenRef.current?.(token),
        'expired-callback': () => onTokenRef.current?.(null),
        'error-callback': () => onTokenRef.current?.(null),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* already gone */
        }
      }
    };
  }, [key]);

  if (!key) return null;
  return <div ref={holderRef} />;
}
