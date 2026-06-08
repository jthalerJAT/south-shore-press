'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { getClientStripe } from '@/lib/stripe/client';
import { PLAN_DISPLAY, type PlanTier } from '@/lib/stripe/plans';
import { PlanCards } from './plan-cards';
import {
  AddressFieldset,
  EMPTY_ADDRESS,
  addressMissingFields,
  type Address,
} from './address-fieldset';

type CreateResponse =
  | { mode: 'complete'; orderId: string; subscriptionId: string }
  | { mode: 'confirm'; orderId: string; subscriptionId: string; clientSecret: string }
  | {
      mode: 'requires_action';
      orderId: string;
      subscriptionId: string;
      clientSecret: string;
    };

export function SubscribeFlow({
  authed,
  paymentsEnabled,
  autofill,
  configured,
  hasPaymentMethod,
  cardLast4,
  cardBrand,
}: {
  authed: boolean;
  paymentsEnabled: boolean;
  autofill: Address;
  configured: Record<PlanTier, boolean>;
  hasPaymentMethod: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
}) {
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [delivery, setDelivery] = useState<Address>(autofill);
  const [billing, setBilling] = useState<Address>(autofill);
  const [billingSame, setBillingSame] = useState(true);
  const [useExistingCard, setUseExistingCard] = useState(hasPaymentMethod);
  const [placed, setPlaced] = useState(false);

  if (!authed) {
    return <AuthGate />;
  }

  if (!paymentsEnabled) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Subscriptions aren&apos;t available on this deployment yet. Please check
        back shortly.
      </div>
    );
  }

  if (placed) {
    return <SuccessPanel />;
  }

  const elementsOptions: StripeElementsOptions = selectedTier
    ? {
        mode: 'subscription',
        amount: PLAN_DISPLAY[selectedTier].amount * 100,
        currency: 'usd',
        appearance: { theme: 'stripe', variables: { colorPrimary: '#dc2626' } },
      }
    : { mode: 'subscription', amount: 100, currency: 'usd' };

  return (
    <div className="flex flex-col gap-10">
      <Section title="Choose your subscription">
        <PlanCards
          selected={selectedTier}
          onSelect={setSelectedTier}
          configured={configured}
        />
      </Section>

      {selectedTier ? (
        <>
          <Section title="Delivery Information">
            <AddressFieldset
              idPrefix="delivery"
              value={delivery}
              onChange={setDelivery}
            />
          </Section>

          <Section title="Billing Information">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
                className="h-4 w-4 accent-brand-red"
              />
              Same as Delivery Information
            </label>
            {!billingSame ? (
              <div className="mt-4">
                <AddressFieldset
                  idPrefix="billing"
                  value={billing}
                  onChange={setBilling}
                />
              </div>
            ) : null}
          </Section>

          {/* Elements is keyed by tier so a plan change remounts the
              PaymentElement with the correct amount. */}
          <Elements key={selectedTier} stripe={getClientStripe()} options={elementsOptions}>
            <PaymentAndPlaceOrder
              tier={selectedTier}
              delivery={delivery}
              billing={billing}
              billingSame={billingSame}
              useExistingCard={useExistingCard}
              onChangeUseExistingCard={setUseExistingCard}
              hasPaymentMethod={hasPaymentMethod}
              cardLast4={cardLast4}
              cardBrand={cardBrand}
              onPlaced={() => setPlaced(true)}
            />
          </Elements>
        </>
      ) : null}
    </div>
  );
}

function PaymentAndPlaceOrder({
  tier,
  delivery,
  billing,
  billingSame,
  useExistingCard,
  onChangeUseExistingCard,
  hasPaymentMethod,
  cardLast4,
  cardBrand,
  onPlaced,
}: {
  tier: PlanTier;
  delivery: Address;
  billing: Address;
  billingSame: boolean;
  useExistingCard: boolean;
  onChangeUseExistingCard: (v: boolean) => void;
  hasPaymentMethod: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  onPlaced: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlaceOrder() {
    setError(null);

    // Client-side guard (the server re-validates).
    const missingDelivery = addressMissingFields(delivery);
    if (missingDelivery.length > 0) {
      setError(`Please complete your delivery information: ${missingDelivery.join(', ')}.`);
      return;
    }
    if (!billingSame) {
      const missingBilling = addressMissingFields(billing);
      if (missingBilling.length > 0) {
        setError(`Please complete your billing information: ${missingBilling.join(', ')}.`);
        return;
      }
    }

    if (!stripe || !elements) return;
    setSubmitting(true);

    // New-card path: validate the PaymentElement before creating the sub.
    if (!useExistingCard) {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? 'Please check your card details.');
        setSubmitting(false);
        return;
      }
    }

    let data: CreateResponse;
    try {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: tier,
          delivery,
          billing: billingSame ? null : billing,
          billingSameAsDelivery: billingSame,
          useExistingCard,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not place your order. Please try again.');
        setSubmitting(false);
        return;
      }
      data = json as CreateResponse;
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
      return;
    }

    const returnUrl = `${window.location.origin}/account/subscription`;

    if (data.mode === 'confirm') {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });
      if (confirmError) {
        setError(confirmError.message ?? 'Payment could not be completed.');
        setSubmitting(false);
        return;
      }
    } else if (data.mode === 'requires_action') {
      const { error: actionError } = await stripe.handleNextAction({
        clientSecret: data.clientSecret,
      });
      if (actionError) {
        setError(actionError.message ?? 'Payment could not be completed.');
        setSubmitting(false);
        return;
      }
    }
    // mode === 'complete' falls straight through to success.

    router.refresh();
    onPlaced();
    setSubmitting(false);
  }

  const plan = PLAN_DISPLAY[tier];

  return (
    <Section title="Payment Information">
      {hasPaymentMethod ? (
        <div className="mb-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="card-choice"
              checked={useExistingCard}
              onChange={() => onChangeUseExistingCard(true)}
              className="h-4 w-4 accent-brand-red"
            />
            Use card on file:{' '}
            <span className="font-medium text-zinc-900">
              {cardBrand?.toUpperCase() ?? 'Card'} ···· {cardLast4 ?? '????'}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="card-choice"
              checked={!useExistingCard}
              onChange={() => onChangeUseExistingCard(false)}
              className="h-4 w-4 accent-brand-red"
            />
            Use a new card
          </label>
        </div>
      ) : null}

      {!useExistingCard ? <PaymentElement /> : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={!stripe || submitting}
        className="mt-6 inline-flex items-center justify-center px-6 py-3 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
      >
        {submitting ? 'Placing order…' : `Place Your Order — ${plan.priceLine}`}
      </button>

      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-zinc-500">
        By placing your order you authorize The South Shore Press to charge your
        card {plan.priceLine}. Your subscription renews automatically upon
        expiration of your purchase term unless you cancel in advance of the
        renewal date. Monthly subscribers are billed one month in advance; if you
        cancel, delivery continues for 30 days after cancellation. You can cancel
        anytime from My Account → Subscription.
      </p>
    </Section>
  );
}

function AuthGate() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-6 max-w-xl">
      <h2 className="font-headline text-lg font-bold text-zinc-900">
        Sign in to subscribe
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        You&apos;ll need an account to manage your subscription and delivery. Sign
        in, or create one — it only takes a minute.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/signin?next=/subscribe"
          className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup?next=/subscribe"
          className="inline-flex items-center px-4 py-2 text-zinc-700 border border-zinc-300 hover:bg-zinc-100 text-sm font-medium rounded transition-colors"
        >
          Create account
        </Link>
      </div>
      <p className="mt-4 text-sm text-zinc-500">
        Forgot your password?{' '}
        <Link href="/forgot-password" className="text-brand-red hover:underline">
          Reset it here
        </Link>
        .
      </p>
    </div>
  );
}

function SuccessPanel() {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-6 max-w-xl">
      <h2 className="font-headline text-lg font-bold text-emerald-900">
        Thank you for subscribing!
      </h2>
      <p className="mt-2 text-sm text-emerald-800">
        Your subscription is being activated. You can view its status and manage
        renewal anytime from your account.
      </p>
      <Link
        href="/account/subscription"
        className="mt-5 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
      >
        View my subscription
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-headline text-xl font-bold text-zinc-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
