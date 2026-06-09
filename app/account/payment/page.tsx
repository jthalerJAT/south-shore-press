import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { AccountShell } from '@/components/account/account-shell';
import { isStripeEnabled } from '@/lib/stripe/server';
import { listCustomerCharges } from '@/lib/stripe/charges';
import { PaymentTabs } from './payment-tabs';

export const metadata: Metadata = {
  title: 'Payment · My account',
  robots: { index: false, follow: false },
};

export default async function AccountPaymentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/account/payment');

  const profile = await getMyProfile(user.id);
  const stripeReady = isStripeEnabled();
  const charges = stripeReady
    ? await listCustomerCharges(profile?.stripe_customer_id ?? null)
    : [];

  return (
    <AccountShell
      user={{
        email: profile?.email ?? user.email,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
      }}
      activeTab="payment"
    >
      <h2 className="font-headline text-xl font-bold text-zinc-900">Payment</h2>
      <p className="mt-1 text-sm text-zinc-600 max-w-xl">
        Manage the card on file and review your payment history.
      </p>

      <div className="mt-6">
        {!stripeReady ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 max-w-xl">
            Payments aren&apos;t configured on this deployment yet. Once the
            Stripe keys are added to Vercel, you&apos;ll be able to add a card here.
          </div>
        ) : (
          <PaymentTabs
            hasExistingCard={profile?.has_payment_method ?? false}
            existingLast4={profile?.payment_method_last4 ?? null}
            existingBrand={profile?.payment_method_brand ?? null}
            charges={charges}
          />
        )}
      </div>
    </AccountShell>
  );
}
