import { PLAN_DISPLAY, isPlanTier } from '@/lib/stripe/plans';
import { SubscriptionControls } from '@/app/account/subscription/subscription-controls';
import type { SubscriptionOrder } from '@/lib/queries/subscription-order';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Presentational card for a single subscription — tier, status, renewal /
 * cancellation state, and its own Cancel/Resume control. Shared by
 * /account/subscription and the /subscribe existing-subscriber summary.
 */
export function SubscriptionCard({ order }: { order: SubscriptionOrder }) {
  const tierLabel = isPlanTier(order.plan_tier)
    ? PLAN_DISPLAY[order.plan_tier].label
    : order.plan_tier;
  const cancelAtEnd = order.cancel_at_period_end;
  const periodEnd = formatDate(order.current_period_end);
  const pastDue = order.status === 'past_due';

  return (
    <div
      className={`rounded border px-4 py-4 ${
        pastDue
          ? 'border-red-200 bg-red-50'
          : cancelAtEnd
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <p className="text-sm font-semibold text-zinc-900">{tierLabel}</p>

      {pastDue ? (
        <p className="mt-2 text-sm text-red-800">
          Payment failed — this subscription is past due. Update your payment
          method to keep it active.
        </p>
      ) : cancelAtEnd ? (
        <p className="mt-2 text-sm text-amber-800">
          Will <strong>not renew</strong>.
          {periodEnd ? <> Active until <strong>{periodEnd}</strong>.</> : null}
        </p>
      ) : (
        <p className="mt-2 text-sm text-emerald-800">
          {periodEnd ? (
            <>Renews automatically on <strong>{periodEnd}</strong>.</>
          ) : (
            <>Renews automatically.</>
          )}
        </p>
      )}

      {order.stripe_subscription_id ? (
        <SubscriptionControls
          subscriptionId={order.stripe_subscription_id}
          cancelAtPeriodEnd={cancelAtEnd}
        />
      ) : null}
    </div>
  );
}
