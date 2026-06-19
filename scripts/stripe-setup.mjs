/**
 * One-shot Stripe setup for the subscription checkout.
 *
 * Creates (idempotently) the 3 recurring Products + Prices and the webhook
 * endpoint, then prints the env values to paste into Vercel. Safe to re-run:
 * prices are keyed by lookup_key and the webhook is matched by URL, so a
 * second run reuses what already exists instead of duplicating it.
 *
 * Usage (PowerShell):
 *   $env:STRIPE_SECRET_KEY="sk_live_or_test_..."; node scripts/stripe-setup.mjs
 *
 * Optional overrides:
 *   $env:WEBHOOK_URL="https://south-shore-press.vercel.app/api/stripe/webhook"
 *
 * Run with a TEST key (sk_test_…) first to dry-run the whole flow, then
 * re-run with your LIVE key (sk_live_…) for production. The lookup_keys
 * keep the two modes independent — each Stripe mode has its own objects.
 */

import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error('✖ STRIPE_SECRET_KEY is not set. Aborting.');
  process.exit(1);
}

const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });
const mode = secret.startsWith('sk_live_') ? 'LIVE' : 'TEST';

const WEBHOOK_URL =
  process.env.WEBHOOK_URL ??
  'https://south-shore-press.vercel.app/api/stripe/webhook';

const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
];

// tier → product/price definition. lookup_key makes price creation idempotent.
const PLANS = [
  {
    envVar: 'STRIPE_PRICE_ALL_ACCESS',
    lookupKey: 'ssp_all_access',
    productName: 'All-Access Pass',
    amount: 50000, // $500.00
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_PRINT_ANNUAL',
    lookupKey: 'ssp_print_annual',
    productName: 'Weekly Newspaper Delivery (Annual)',
    amount: 10000, // $100.00
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_PRINT_MONTHLY',
    lookupKey: 'ssp_print_monthly',
    productName: 'Weekly Newspaper Delivery (Monthly)',
    amount: 1000, // $10.00
    interval: 'month',
  },
];

async function ensurePrice(plan) {
  // Reuse an existing price with this lookup_key if present.
  const existing = await stripe.prices.list({
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    const price = existing.data[0];
    if (price.unit_amount !== plan.amount) {
      // Stripe prices are immutable — we can't change this one's amount. To
      // apply the new price, archive (deactivate) the old price in the Stripe
      // dashboard so its lookup_key frees up, then re-run this script: it will
      // create a fresh price at the new amount and print the new env value.
      console.log(
        `  ⚠ ${plan.productName}: existing price ${price.id} is $${
          (price.unit_amount ?? 0) / 100
        }/${plan.interval}, but the catalog now wants $${plan.amount / 100}. ` +
          `Archive the old price in Stripe, then re-run to create the new one.`
      );
      return price.id;
    }
    console.log(`  ↺ ${plan.productName}: reusing existing price ${price.id}`);
    return price.id;
  }

  const product = await stripe.products.create({
    name: plan.productName,
    metadata: { ssp_tier: plan.lookupKey },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.amount,
    currency: 'usd',
    recurring: { interval: plan.interval },
    lookup_key: plan.lookupKey,
    metadata: { ssp_tier: plan.lookupKey },
  });
  console.log(
    `  ✚ ${plan.productName}: created price ${price.id} ($${plan.amount / 100}/${plan.interval})`
  );
  return price.id;
}

async function ensureWebhook() {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = endpoints.data.find((e) => e.url === WEBHOOK_URL);
  if (match) {
    // Make sure the event list is current; secret is NOT retrievable for an
    // existing endpoint (only shown at creation).
    await stripe.webhookEndpoints.update(match.id, { enabled_events: WEBHOOK_EVENTS });
    console.log(`  ↺ Webhook: reusing existing endpoint ${match.id}`);
    console.log(
      '    (signing secret not shown for existing endpoints — roll it in the' +
        ' dashboard if you need it again)'
    );
    return null;
  }
  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: 'South Shore Press subscription sync',
  });
  console.log(`  ✚ Webhook: created endpoint ${created.id}`);
  return created.secret; // whsec_… — only available right now.
}

async function main() {
  console.log(`\n▶ Stripe setup in ${mode} mode\n`);

  const priceIds = {};
  console.log('Products & prices:');
  for (const plan of PLANS) {
    priceIds[plan.envVar] = await ensurePrice(plan);
  }

  console.log('\nWebhook:');
  const webhookSecret = await ensureWebhook();

  console.log('\n────────────────────────────────────────────────────────');
  console.log('Paste these into Vercel → Settings → Environment Variables:');
  console.log('────────────────────────────────────────────────────────');
  for (const plan of PLANS) {
    console.log(`${plan.envVar}=${priceIds[plan.envVar]}`);
  }
  if (webhookSecret) {
    console.log(`STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
  } else {
    console.log('STRIPE_WEBHOOK_SECRET=<unchanged — endpoint already existed>');
  }
  console.log('\nStill set by hand (from the Stripe dashboard / Supabase):');
  console.log('STRIPE_SECRET_KEY=<the key you just ran this with>');
  console.log('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<Developers → API keys>');
  console.log('SUPABASE_SERVICE_ROLE_KEY=<Supabase → Settings → API>');
  console.log('────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('\n✖ Setup failed:', err.message);
  process.exit(1);
});
