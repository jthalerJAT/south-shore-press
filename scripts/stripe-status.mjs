/**
 * Report whether the Stripe account is live-ready.
 *
 * Run with your LIVE secret key to check production activation:
 *   $env:STRIPE_SECRET_KEY="sk_live_…"; node scripts/stripe-status.mjs
 *
 * (Running with a test key always shows charges enabled — it only means
 *  something with sk_live_.)
 */

import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error('✖ STRIPE_SECRET_KEY is not set. Aborting.');
  process.exit(1);
}

const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });
const mode = secret.startsWith('sk_live_') ? 'LIVE' : 'TEST';

async function main() {
  const acct = await stripe.accounts.retrieve();
  const req = acct.requirements ?? {};

  console.log(`\n▶ Stripe account status (${mode} key)\n`);
  console.log(`  Account:          ${acct.id}`);
  console.log(`  Business name:    ${acct.business_profile?.name ?? '—'}`);
  console.log(`  charges_enabled:  ${acct.charges_enabled}   <- can accept live payments`);
  console.log(`  payouts_enabled:  ${acct.payouts_enabled}   <- can pay out to bank`);
  console.log(`  details_submitted:${acct.details_submitted}`);
  console.log(`  disabled_reason:  ${req.disabled_reason ?? 'none'}`);

  const cd = req.currently_due ?? [];
  const pd = req.past_due ?? [];
  const pend = req.pending_verification ?? [];
  console.log(`\n  currently_due (${cd.length}):       ${cd.join(', ') || 'none'}`);
  console.log(`  past_due (${pd.length}):            ${pd.join(', ') || 'none'}`);
  console.log(`  pending_verification (${pend.length}): ${pend.join(', ') || 'none'}`);

  console.log('\n  ----------------------------------------------------------');
  if (mode !== 'LIVE') {
    console.log('  ⚠ Run again with your sk_live_ key to check LIVE activation.');
  } else if (acct.charges_enabled && acct.payouts_enabled && cd.length === 0 && pd.length === 0) {
    console.log('  ✅ LIVE-READY — charges + payouts enabled, nothing outstanding.');
  } else if (acct.charges_enabled) {
    console.log('  ◑ Charges enabled, but items still outstanding (see above).');
  } else {
    console.log('  ⏳ NOT live yet — Stripe still needs the items listed above.');
  }
  console.log('  ----------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('\n✖ Status check failed:', err.message);
  process.exit(1);
});
