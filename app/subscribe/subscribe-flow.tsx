'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getClientStripe } from '@/lib/stripe/client';
import { PLAN_DISPLAY, type PlanTier } from '@/lib/stripe/plans';
import { PlanCards } from './plan-cards';
import {
  AddressFieldset,
  addressMissingFields,
  type Address,
} from './address-fieldset';

const APPEARANCE = {
  theme: 'stripe' as const,
  variables: { colorPrimary: '#dc2626' },
};

type CreateResponse =
  | { mode: 'complete'; orderId: string; subscriptionId: string }
  | { mode: 'confirm'; orderId: string; subscriptionId: string; clientSecret: string }
  | { mode: 'requires_action'; orderId: string; subscriptionId: string; clientSecret: string };

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
  const router = useRouter();
  const [selectedTier, setSelectedTierState] = useState<PlanTier | null>(null);
  const [delivery, setDeliveryState] = useState<Address>(autofill);
  const [billing, setBillingState] = useState<Address>(autofill);
  const [billingSame, setBillingSameState] = useState(true);
  const [useExistingCard, setUseExistingCard] = useState(hasPaymentMethod);
  const [placed, setPlaced] = useState(false);

  // The subscription's PaymentIntent client secret. Created on "Continue to
  // payment"; Elements mounts against it. Reset to null whenever the plan or
  // addresses change, so we never confirm a stale order.
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wrapped setters that invalidate any prepared subscription.
  function setSelectedTier(t: PlanTier) {
    setSelectedTierState(t);
    setClientSecret(null);
    setError(null);
  }
  function setDelivery(a: Address) {
    setDeliveryState(a);
    setClientSecret(null);
  }
  function setBilling(a: Address) {
    setBillingState(a);
    setClientSecret(null);
  }
  function setBillingSame(v: boolean) {
    setBillingSameState(v);
    setClientSecret(null);
  }

  if (!authed) return <AuthGate />;
  if (!paymentsEnabled) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Subscriptions aren&apos;t available on this deployment yet. Please check
        back shortly.
      </div>
    );
  }
  if (placed) return <SuccessPanel />;

  function validateAddresses(): string | null {
    const missing = addressMissingFields(delivery);
    if (missing.length > 0) {
      return `Please complete your delivery information: ${missing.join(', ')}.`;
    }
    if (!billingSame) {
      const billingMissing = addressMissingFields(billing);
      if (billingMissing.length > 0) {
        return `Please complete your billing information: ${billingMissing.join(', ')}.`;
      }
    }
    return null;
  }

  async function createSubscription(existing: boolean): Promise<CreateResponse | null> {
    const res = await fetch('/api/subscriptions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planTier: selectedTier,
        delivery,
        billing: billingSame ? null : billing,
        billingSameAsDelivery: billingSame,
        useExistingCard: existing,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not place your order. Please try again.');
      return null;
    }
    return json as CreateResponse;
  }

  // New-card path: create the subscription, then mount Elements on its
  // PaymentIntent client secret.
  async function handleContinueToPayment() {
    setError(null);
    const addrErr = validateAddresses();
    if (addrErr) {
      setError(addrErr);
      return;
    }
    setPreparing(true);
    const data = await createSubscription(false);
    setPreparing(false);
    if (!data) return;
    if (data.mode === 'complete') {
      router.refresh();
      setPlaced(true);
      return;
    }
    setClientSecret(data.clientSecret);
  }

  // Saved-card path: server charges the default card; we just handle any 3DS.
  async function handlePlaceWithSavedCard() {
    setError(null);
    const addrErr = validateAddresses();
    if (addrErr) {
      setError(addrErr);
      return;
    }
    setPreparing(true);
    const data = await createSubscription(true);
    if (!data) {
      setPreparing(false);
      return;
    }
    if (data.mode === 'requires_action') {
      const stripe = await getClientStripe();
      if (stripe) {
        const { error: actionErr } = await stripe.handleNextAction({
          clientSecret: data.clientSecret,
        });
        if (actionErr) {
          setError(actionErr.message ?? 'Payment could not be completed.');
          setPreparing(false);
          return;
        }
      }
    }
    setPreparing(false);
    router.refresh();
    setPlaced(true);
  }

  return (
    <div className="flex flex-col gap-10">
      <Section title="Choose your subscription">
        <PlanCards selected={selectedTier} onSelect={setSelectedTier} configured={configured} />
      </Section>

      {selectedTier ? (
        <>
          <Section title="Delivery Information">
            <AddressFieldset idPrefix="delivery" value={delivery} onChange={setDelivery} />
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
                <AddressFieldset idPrefix="billing" value={billing} onChange={setBilling} />
              </div>
            ) : null}
          </Section>

          <Section title="Payment Information">
            {hasPaymentMethod ? (
              <div className="mb-4 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name="card-choice"
                    checked={useExistingCard}
                    onChange={() => setUseExistingCard(true)}
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
                    onChange={() => setUseExistingCard(false)}
                    className="h-4 w-4 accent-brand-red"
                  />
                  Use a new card
                </label>
              </div>
            ) : null}

            {useExistingCard ? (
              <>
                <button
                  type="button"
                  onClick={handlePlaceWithSavedCard}
                  disabled={preparing}
                  className={PLACE_BTN}
                >
                  {preparing ? 'Placing order…' : `Place Your Order — ${PLAN_DISPLAY[selectedTier].priceLine}`}
                </button>
                <Disclaimer tier={selectedTier} />
              </>
            ) : !clientSecret ? (
              <>
                <p className="text-sm text-zinc-600">
                  Click below to load the secure card form for{' '}
                  <strong>{PLAN_DISPLAY[selectedTier].priceLine}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleContinueToPayment}
                  disabled={preparing}
                  className={`${PLACE_BTN} mt-3`}
                >
                  {preparing ? 'Loading…' : 'Continue to payment'}
                </button>
              </>
            ) : (
              <Elements
                stripe={getClientStripe()}
                options={{ clientSecret, appearance: APPEARANCE }}
              >
                <ConfirmForm
                  tier={selectedTier}
                  onPlaced={() => {
                    router.refresh();
                    setPlaced(true);
                  }}
                />
              </Elements>
            )}

            {error ? (
              <div
                role="alert"
                className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
              >
                {error}
              </div>
            ) : null}
          </Section>
        </>
      ) : null}
    </div>
  );
}

const PLACE_BTN =
  'inline-flex items-center justify-center px-6 py-3 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors';

/** The card form + Place Your Order, mounted inside <Elements> bound to the
 *  subscription's PaymentIntent client secret. */
function ConfirmForm({ tier, onPlaced }: { tier: PlanTier; onPlaced: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlaceOrder() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/account/subscription`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed.');
      setSubmitting(false);
      return;
    }
    onPlaced();
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {error ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={!stripe || submitting}
        className={PLACE_BTN}
      >
        {submitting ? 'Placing order…' : `Place Your Order — ${PLAN_DISPLAY[tier].priceLine}`}
      </button>
      <Disclaimer tier={tier} />
    </div>
  );
}

function Disclaimer({ tier }: { tier: PlanTier }) {
  return (
    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
      By placing your order you authorize The South Shore Press to charge your
      card {PLAN_DISPLAY[tier].priceLine}. Your subscription renews automatically
      upon expiration of your purchase term unless you cancel in advance of the
      renewal date. Monthly subscribers are billed one month in advance; if you
      cancel, delivery continues for 30 days after cancellation. You can cancel
      anytime from My Account → Subscription.
    </p>
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
