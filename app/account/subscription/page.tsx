import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { getUserSubscriptions } from '@/lib/queries/subscription-order';
import { AccountShell } from '@/components/account/account-shell';
import { SubscriptionCard } from '@/components/subscription/subscription-card';

export const metadata: Metadata = {
  title: 'Subscription · My account',
  robots: { index: false, follow: false },
};

export default async function AccountSubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/account/subscription');

  const [profile, subscriptions] = await Promise.all([
    getMyProfile(user.id),
    getUserSubscriptions(user.id),
  ]);

  return (
    <AccountShell
      user={{
        email: profile?.email ?? user.email,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
      }}
      activeTab="subscription"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-headline text-xl font-bold text-zinc-900">
          {subscriptions.length > 1 ? 'Your subscriptions' : 'Subscription'}
        </h2>
        {subscriptions.length > 0 ? (
          <Link
            href="/subscribe"
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-brand-red border border-brand-red/40 hover:bg-red-50 rounded transition-colors"
          >
            Add a subscription
          </Link>
        ) : null}
      </div>

      <div className="mt-6 max-w-xl space-y-4">
        {subscriptions.length > 0 ? (
          subscriptions.map((order) => (
            <SubscriptionCard key={order.id} order={order} />
          ))
        ) : (
          <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-sm text-zinc-700">
              You&apos;re on the free tier. Subscribing supports our local-news
              work and gets the paper delivered to your door.
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
