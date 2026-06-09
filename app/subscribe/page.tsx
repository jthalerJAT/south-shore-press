import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { isStripeEnabled } from '@/lib/stripe/server';
import { isPlanConfigured, type PlanTier } from '@/lib/stripe/plans';
import { maskPhoneInput } from '@/lib/phone';
import { getCustomerDefaultCard } from '@/lib/stripe/payment-method';
import { getUserSubscriptions } from '@/lib/queries/subscription-order';
import { SubscriptionCard } from '@/components/subscription/subscription-card';
import { SubscribeFlow } from './subscribe-flow';
import type { Address } from './address-fieldset';

export const metadata: Metadata = {
  title: 'Subscribe',
  description:
    'Subscribe to The South Shore Press — digital and print options for the news your community runs on.',
};

// Reads the signed-in user + Stripe config on every request.
export const dynamic = 'force-dynamic';

export default async function SubscribePage() {
  const user = await getCurrentUser();
  const profile = user ? await getMyProfile(user.id) : null;
  const subscriptions = user ? await getUserSubscriptions(user.id) : [];
  const card = user
    ? await getCustomerDefaultCard(profile?.stripe_customer_id ?? null)
    : null;

  const autofill: Address = {
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    company: '',
    address_1: profile?.street_address ?? '',
    address_2: '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    zip: profile?.zip_code ?? '',
    email: profile?.email ?? user?.email ?? '',
    phone: profile?.phone ? maskPhoneInput(profile.phone) : '',
  };

  const configured: Record<PlanTier, boolean> = {
    all_access: isPlanConfigured('all_access'),
    print_annual: isPlanConfigured('print_annual'),
    print_monthly: isPlanConfigured('print_monthly'),
  };

  return (
    <section className="max-w-2xl mx-auto px-6 py-12 sm:py-16">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-brand-red font-bold">
          Subscribe
        </div>
        <h1 className="mt-3 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">
          Support local journalism.
        </h1>
        <p className="mt-6 text-lg text-zinc-600 leading-relaxed">
          The South Shore Press is built and paid for here on Long Island. Paid
          subscriptions keep our reporters on the beat — covering town boards,
          school districts, courts, and the community news no one else does. We
          sincerely appreciate your support!
        </p>
      </div>

      {subscriptions.length > 0 ? (
        <div className="mt-10">
          <h2 className="font-headline text-lg font-bold text-zinc-900">
            Your current {subscriptions.length > 1 ? 'subscriptions' : 'subscription'}
          </h2>
          <div className="mt-4 space-y-4">
            {subscriptions.map((order) => (
              <SubscriptionCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-12">
        <SubscribeFlow
          authed={Boolean(user)}
          paymentsEnabled={isStripeEnabled()}
          autofill={autofill}
          configured={configured}
          hasPaymentMethod={Boolean(card)}
          cardLast4={card?.last4 ?? null}
          cardBrand={card?.brand ?? null}
          hasExistingSubscriptions={subscriptions.length > 0}
        />
      </div>
    </section>
  );
}
