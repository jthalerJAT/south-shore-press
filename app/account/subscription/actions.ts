'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';

export type SubActionState = {
  error: string | null;
  success: boolean;
};

/** Verify the given Stripe subscription id belongs to the signed-in user
 *  (via their own subscription_orders rows). Returns true if owned. */
async function ownsSubscription(userId: string, subscriptionId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from('subscription_orders')
    .select('id')
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  return Boolean(data);
}

async function setAutoRenew(
  formData: FormData,
  cancelAtPeriodEnd: boolean
): Promise<SubActionState> {
  const user = await requireUser('/account/subscription');
  const stripe = getStripe();
  if (!stripe) {
    return { error: 'Payments are not enabled on this deployment.', success: false };
  }

  const subscriptionId = String(formData.get('subscriptionId') ?? '').trim();
  if (!subscriptionId) {
    return { error: 'Missing subscription.', success: false };
  }
  if (!(await ownsSubscription(user.id, subscriptionId))) {
    return { error: 'Subscription not found.', success: false };
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  } catch (err) {
    console.error('[setAutoRenew]', err);
    return { error: 'Could not update your subscription. Please try again.', success: false };
  }

  // Optimistic local write; the webhook is the canonical sync.
  const supabase = createClient();
  await supabase
    .from('subscription_orders')
    .update({ cancel_at_period_end: cancelAtPeriodEnd })
    .eq('user_id', user.id)
    .eq('stripe_subscription_id', subscriptionId);

  revalidatePath('/account/subscription');
  revalidatePath('/subscribe');
  return { error: null, success: true };
}

/** Stop auto-renewal for a specific subscription. The subscriber keeps
 *  access through the paid period (≈30 days for monthly, billed a month
 *  in advance). */
export async function cancelSubscriptionAction(
  _prev: SubActionState,
  formData: FormData
): Promise<SubActionState> {
  return setAutoRenew(formData, true);
}

/** Re-enable auto-renewal for a specific subscription. */
export async function resumeSubscriptionAction(
  _prev: SubActionState,
  formData: FormData
): Promise<SubActionState> {
  return setAutoRenew(formData, false);
}
