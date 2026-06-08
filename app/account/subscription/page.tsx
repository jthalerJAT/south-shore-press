import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { AccountShell } from '@/components/account/account-shell';
import { PLAN_DISPLAY, isPlanTier } from '@/lib/stripe/plans';
import { SubscriptionControls } from './subscription-controls';

export const metadata: Metadata = {
  title: 'Subscription · My account',
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function AccountSubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/account/subscription');

  const profile = await getMyProfile(user.id);
  const status = profile?.subscription_status ?? null;
  const tier = profile?.subscription_tier ?? null;
  const isActive = status === 'active' || status === 'trialing';
  const cancelAtEnd = profile?.subscription_cancel_at_period_end ?? false;
  const periodEnd = formatDate(profile?.subscription_current_period_end ?? null);

  const tierLabel = tier && isPlanTier(tier) ? PLAN_DISPLAY[tier].label : tier;

  return (
    <AccountShell
      user={{
        email: profile?.email ?? user.email,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
      }}
      activeTab="subscription"
    >
      <h2 className="font-headline text-xl font-bold text-zinc-900">Subscription</h2>

      <div className="mt-6 max-w-xl">
        {isActive ? (
          <div
            className={`rounded border px-4 py-4 ${
              cancelAtEnd
                ? 'border-amber-200 bg-amber-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <p
              className={`text-sm ${
                cancelAtEnd ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              You&apos;re subscribed
              {tierLabel ? (
                <>
                  {' '}
                  to <strong>{tierLabel}</strong>
                </>
              ) : null}
              .
            </p>

            {cancelAtEnd ? (
              <p className="mt-2 text-sm text-amber-800">
                Your subscription will <strong>not renew</strong>.
                {periodEnd ? <> It stays active until <strong>{periodEnd}</strong>.</> : null}
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

            <SubscriptionControls cancelAtPeriodEnd={cancelAtEnd} />
          </div>
        ) : (
          <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-sm text-zinc-700">
              {status === 'past_due'
                ? 'Your last payment failed and your subscription is past due. Please update your payment method to keep your subscription active.'
                : "You're on the free tier. Subscribing supports our local-news work and gets the paper delivered to your door."}
            </p>
            <Link
              href="/subscribe"
              className="mt-3 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
            >
              See subscription options
            </Link>
          </div>
        )}
      </div>
    </AccountShell>
  );
}
