'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Client-side Stripe.js loader. Cached at module scope so we only fetch
 * the Stripe.js bundle once. Returns null if the publishable key isn't
 * set — the calling component renders a "Payment unavailable" state.
 */

let stripePromise: Promise<Stripe | null> | null = null;

export function getClientStripe(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    if (!stripePromise) stripePromise = Promise.resolve(null);
    return stripePromise;
  }
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export function isStripeClientEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
