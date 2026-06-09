import type Stripe from 'stripe';
import { getStripe } from './server';

export type CardOnFile = { last4: string | null; brand: string | null };

/** The customer's card on file, read live from Stripe (source of truth) —
 *  the customer's default invoice payment method, falling back to their most
 *  recent saved card. Returns null if Stripe isn't configured, there's no
 *  customer, or no card. Server-side only. */
export async function getCustomerDefaultCard(
  customerId: string | null | undefined
): Promise<CardOnFile | null> {
  const stripe = getStripe();
  if (!stripe || !customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return null;

    const dpm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    let pmId = typeof dpm === 'string' ? dpm : dpm?.id ?? null;

    if (!pmId) {
      const pms = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      });
      pmId = pms.data[0]?.id ?? null;
    }
    if (!pmId) return null;

    const pm = await stripe.paymentMethods.retrieve(pmId);
    return { last4: pm.card?.last4 ?? null, brand: pm.card?.brand ?? null };
  } catch (err) {
    console.error('[getCustomerDefaultCard]', err);
    return null;
  }
}
