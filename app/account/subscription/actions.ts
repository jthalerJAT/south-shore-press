'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';

export type SubActionState = {
  error: string | null;
  success: boolean;
};

/** Look up the signed-in user's live subscription id. */
async function getSubscriptionId(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  return (data?.stripe_subscription_id as string | null) ?? null;
}

/**
 * Stop auto-renewal. Sets cancel_at_period_end so the subscriber keeps
 * access (and delivery) through the paid period — for monthly subscribers,
 * who are billed a month in advance, that's ~30 days. The webhook syncs
 * the canonical flag; we also write it optimistically for an instant UI.
 */
export async function cancelSubscriptionAction(
  _prev: SubActionState,
  _formData: FormData
): Promise<SubActionState> {
  const user = await requireUser('/account/subscription');
  const stripe = getStripe();
  if (!stripe) {
    return { error: 'Payments are not enabled on this deployment.', success: false };
  }

  const subId = await getSubscriptionId(user.id);
  if (!subId) {
    return { error: 'No active subscription found.', success: false };
  }

  try {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  } catch (err) {
    console.error('[cancelSubscriptionAction]', err);
    return { error: 'Could not cancel your subscription. Please try again.', success: false };
  }

  const supabase = createClient();
  await supabase
    .from('profiles')
    .update({ subscription_cancel_at_period_end: true })
    .eq('id', user.id);

  revalidatePath('/account/subscription');
  return { error: null, success: true };
}

/** Re-enable auto-renewal (undo a pending cancellation). */
export async function resumeSubscriptionAction(
  _prev: SubActionState,
  _formData: FormData
): Promise<SubActionState> {
  const user = await requireUser('/account/subscription');
  const stripe = getStripe();
  if (!stripe) {
    return { error: 'Payments are not enabled on this deployment.', success: false };
  }

  const subId = await getSubscriptionId(user.id);
  if (!subId) {
    return { error: 'No active subscription found.', success: false };
  }

  try {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
  } catch (err) {
    console.error('[resumeSubscriptionAction]', err);
    return { error: 'Could not resume your subscription. Please try again.', success: false };
  }

  const supabase = createClient();
  await supabase
    .from('profiles')
    .update({ subscription_cancel_at_period_end: false })
    .eq('id', user.id);

  revalidatePath('/account/subscription');
  return { error: null, success: true };
}
