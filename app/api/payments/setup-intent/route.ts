import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/setup-intent
 *
 * Creates (or fetches) the signed-in user's Stripe Customer and returns
 * a SetupIntent client_secret. The client uses @stripe/react-stripe-js
 * to confirm the SetupIntent with a CardElement, then POSTs the resulting
 * PaymentMethod ID to /api/payments/save-card to persist last4 + brand.
 *
 * Returns 503 if Stripe isn't configured for this deployment.
 */
export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not enabled on this deployment.' },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const supabase = createClient();

  // Fetch the profile for the cached customer id + display name.
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('stripe_customer_id, first_name, last_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('[setup-intent] profile fetch failed', profileErr);
    return NextResponse.json({ error: 'Profile lookup failed.' }, { status: 500 });
  }

  let customerId = profile?.stripe_customer_id ?? null;

  // First time: create the Stripe Customer + cache its id on the profile.
  if (!customerId) {
    const name = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || undefined;

    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      name,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    const { error: writeErr } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
    if (writeErr) {
      console.error('[setup-intent] customer id write failed', writeErr);
      // Not fatal — the SetupIntent still works, we just won't have the
      // cache and will re-create a Customer on the next call.
    }
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    customerId,
  });
}
