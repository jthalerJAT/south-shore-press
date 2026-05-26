import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { AccountShell } from '@/components/account/account-shell';

export const metadata: Metadata = {
  title: 'Subscription · My account',
  robots: { index: false, follow: false },
};

export default async function AccountSubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/account/subscription');

  const profile = await getMyProfile(user.id);
  const status = profile?.subscription_status ?? null;
  const tier = profile?.subscription_tier ?? null;
  const isActive = status === 'active' || status === 'trialing';

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
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm text-emerald-900">
              You&apos;re subscribed
              {tier ? <> to the <strong>{tier}</strong> tier</> : null}.
            </p>
            <p className="mt-2 text-xs text-emerald-800">
              Status: {status}
            </p>
          </div>
        ) : (
          <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-sm text-zinc-700">
              You&apos;re on the free tier. Subscribing unlocks the full archive
              and supports our local-news work.
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
