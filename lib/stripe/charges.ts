import { getStripe } from './server';

/** A charge row shaped for the Payment History tab. */
export type ChargeRow = {
  id: string;
  created: number; // unix seconds
  amount: number; // smallest currency unit (cents)
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  refunded: boolean;
  description: string | null;
};

/** List a customer's charges (most recent first) for the Payment History
 *  tab. Returns [] if Stripe isn't configured or the user has no customer
 *  yet. Server-side only (uses the secret-key Stripe client). */
export async function listCustomerCharges(
  customerId: string | null | undefined,
  limit = 24
): Promise<ChargeRow[]> {
  const stripe = getStripe();
  if (!stripe || !customerId) return [];
  try {
    const charges = await stripe.charges.list({ customer: customerId, limit });
    return charges.data.map((c) => ({
      id: c.id,
      created: c.created,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      refunded: c.refunded,
      description: c.description ?? null,
    }));
  } catch (err) {
    console.error('[listCustomerCharges]', err);
    return [];
  }
}
