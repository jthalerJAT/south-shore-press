import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/save-card  { paymentMethodId: string }
 *
 * Called by the client after a SetupIntent is confirmed. Fetches the
 * PaymentMethod from Stripe to read last4 + brand, attaches it as the
 * customer's default payment method, and persists the snapshot to the
 * user's profile row.
 */
export async function POST(req: Request) {
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

  const { paymentMethodId } = (await req.json().catch(() => ({}))) as {
    paymentMethodId?: string;
  };
  if (!paymentMethodId) {
    return NextResponse.json({ error: 'paymentMethodId is required.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Create a SetupIntent first.' },
      { status: 400 }
    );
  }

  // Retrieve the PaymentMethod to confirm it belongs to this customer
  // and to capture last4 + brand for the UI.
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer && pm.customer !== customerId) {
    return NextResponse.json(
      { error: 'Payment method does not belong to this user.' },
      { status: 403 }
    );
  }

  // Attach if not already, then set as default for invoices.
  if (!pm.customer) {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  }
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const last4 = pm.card?.last4 ?? null;
  const brand = pm.card?.brand ?? null;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      has_payment_method: true,
      payment_method_last4: last4,
      payment_method_brand: brand,
    })
    .eq('id', user.id);

  if (updateErr) {
    console.error('[save-card] profile update failed', updateErr);
    return NextResponse.json({ error: 'Failed to save payment method.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, last4, brand });
}
