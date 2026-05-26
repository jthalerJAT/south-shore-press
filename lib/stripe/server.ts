import Stripe from 'stripe';

/**
 * Server-side Stripe client. Lazily initialized — if STRIPE_SECRET_KEY
 * isn't set in the environment (e.g. on a preview build before the key
 * is configured), `getStripe()` returns null and route handlers gate
 * accordingly. This lets the rest of the app build + deploy without
 * Stripe wired, so we don't block on env-var provisioning.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  cached = new Stripe(key, {
    apiVersion: '2023-10-16',
    typescript: true,
  });

  return cached;
}

/** True if Stripe is configured for this deployment. Used by UI to
 *  conditionally render the payment card section. */
export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
