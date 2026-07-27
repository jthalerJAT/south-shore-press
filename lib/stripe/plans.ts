/**
 * Subscription plan catalog — the single source of truth for the three
 * paid tiers. Split into two halves:
 *
 *   - PLAN_DISPLAY: pure, client-safe constants (label, blurb, price copy,
 *     interval). Safe to import into client components — no secrets.
 *   - getPriceId / tierForPriceId / isPlanConfigured: resolve the Stripe
 *     Price IDs from server-only env vars (STRIPE_PRICE_*). These are
 *     called server-side only (create route + webhook). The env vars are
 *     NOT NEXT_PUBLIC, so they're stripped from any client bundle anyway.
 *
 * The Price IDs are created once in the Stripe dashboard (live mode) and
 * referenced here by env var — dashboard-created prices are stable and
 * auditable, and we never risk creating duplicate prices on deploy.
 */

export type PlanTier = 'all_access' | 'print_annual' | 'print_monthly' | 'intro_annual';

/** VALUE RANKING (best first) — the webhook's bestTier() walks this order to
 *  compute a subscriber's top active tier. NOT the display order (PLAN_LIST). */
export const PLAN_TIERS: readonly PlanTier[] = [
  'all_access',
  'print_annual',
  'intro_annual',
  'print_monthly',
] as const;

export type PlanDisplay = {
  tier: PlanTier;
  label: string;
  blurb: string;
  /** Amount in whole dollars, for display only. */
  amount: number;
  interval: 'year' | 'month';
  /** Pre-formatted price line, e.g. "$1,000 per year". */
  priceLine: string;
};

export const PLAN_DISPLAY: Record<PlanTier, PlanDisplay> = {
  all_access: {
    tier: 'all_access',
    label: 'All-Access Pass',
    blurb:
      'Unlimited access to all digital content PLUS weekly delivery of our physical newspaper. We thank our loyal customers for supporting us with this option!',
    amount: 500,
    interval: 'year',
    priceLine: '$500 per year',
  },
  print_annual: {
    tier: 'print_annual',
    label: 'Weekly Newspaper Delivery (One Year Subscription)',
    blurb: 'Get our weekly newspaper delivered to your door for one year.',
    amount: 100,
    interval: 'year',
    priceLine: '$100 per year',
  },
  print_monthly: {
    tier: 'print_monthly',
    label: 'Weekly Newspaper Delivery (Monthly Subscription)',
    blurb:
      'Get our weekly newspaper delivered to your door on a monthly subscription, cancel anytime.',
    amount: 10,
    interval: 'month',
    priceLine: '$10 per month',
  },
  intro_annual: {
    tier: 'intro_annual',
    label: 'Introductory Limited Time Offer (One Year Subscription)',
    blurb: 'First year of South Shore Press delivered to your door for $49.99',
    amount: 49.99,
    interval: 'year',
    priceLine: '$49.99 per year',
  },
};

/** DISPLAY order for the plan cards — the introductory offer leads (it's the
 *  one the welcome flyer sends readers to), then the standing plans by value. */
export const PLAN_LIST: readonly PlanDisplay[] = [
  PLAN_DISPLAY.intro_annual,
  PLAN_DISPLAY.all_access,
  PLAN_DISPLAY.print_annual,
  PLAN_DISPLAY.print_monthly,
];

/** True if a string is one of our known tiers (input validation). */
export function isPlanTier(value: unknown): value is PlanTier {
  return (
    value === 'all_access' ||
    value === 'print_annual' ||
    value === 'print_monthly' ||
    value === 'intro_annual'
  );
}

// ---- Server-only resolution (Stripe Price IDs) -------------------------

const PRICE_ENV: Record<PlanTier, string> = {
  all_access: 'STRIPE_PRICE_ALL_ACCESS',
  print_annual: 'STRIPE_PRICE_PRINT_ANNUAL',
  print_monthly: 'STRIPE_PRICE_PRINT_MONTHLY',
  intro_annual: 'STRIPE_PRICE_INTRO_ANNUAL',
};

/** Resolve the Stripe Price ID for a tier, or null if its env var isn't
 *  configured on this deployment. Server-side only. */
export function getPriceId(tier: PlanTier): string | null {
  return process.env[PRICE_ENV[tier]] ?? null;
}

/** Reverse lookup: which tier does a Stripe Price ID belong to? Used by
 *  the webhook to map an incoming subscription back to a tier. Server-side
 *  only. Returns null if the price doesn't match any configured tier. */
export function tierForPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  for (const tier of PLAN_TIERS) {
    if (process.env[PRICE_ENV[tier]] === priceId) return tier;
  }
  return null;
}

/** True if this tier's Price ID is configured (env var set). Drives the
 *  "card disabled until configured" UI on /subscribe. Server-side only. */
export function isPlanConfigured(tier: PlanTier): boolean {
  return Boolean(getPriceId(tier));
}
