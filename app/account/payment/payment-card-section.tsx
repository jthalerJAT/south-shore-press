'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getClientStripe } from '@/lib/stripe/client';

/**
 * Client wrapper that requests a SetupIntent from the server, mounts
 * Stripe Elements with the resulting clientSecret, and handles the
 * confirm + save round trip.
 *
 * The PaymentElement is Stripe's universal multi-payment-method UI;
 * we restrict it to card via the SetupIntent's payment_method_types.
 */
export function PaymentCardSection({
  hasExistingCard,
  existingLast4,
  existingBrand,
}: {
  hasExistingCard: boolean;
  existingLast4: string | null;
  existingBrand: string | null;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(!hasExistingCard);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!showForm) return;
    let cancelled = false;
    setFetchError(null);
    fetch('/api/payments/setup-intent', { method: 'POST' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setClientSecret(data.clientSecret);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setFetchError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [showForm]);

  if (!showForm) {
    return (
      <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4 max-w-xl">
        <p className="text-sm text-zinc-700">
          Card on file:{' '}
          <span className="font-medium text-zinc-900">
            {existingBrand?.toUpperCase() ?? 'Card'} ···· {existingLast4 ?? '????'}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 inline-flex items-center px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-100 rounded transition-colors"
        >
          Replace card
        </button>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 max-w-xl">
        {fetchError}
      </div>
    );
  }

  if (!clientSecret) {
    return <p className="text-sm text-zinc-500">Loading payment form…</p>;
  }

  return (
    <Elements
      stripe={getClientStripe()}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#dc2626' },
        },
      }}
    >
      <ConfirmCardForm
        onDone={() => {
          setShowForm(false);
        }}
        onCancel={hasExistingCard ? () => setShowForm(false) : undefined}
      />
    </Elements>
  );
}

function ConfirmCardForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'Could not save card.');
      setSubmitting(false);
      return;
    }

    const setupIntent = result.setupIntent;
    const paymentMethodId =
      typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (!paymentMethodId) {
      setError('No payment method returned. Try again.');
      setSubmitting(false);
      return;
    }

    const saveRes = await fetch('/api/payments/save-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodId }),
    });
    if (!saveRes.ok) {
      const body = await saveRes.json().catch(() => ({}));
      setError(body.error ?? 'Could not save card.');
      setSubmitting(false);
      return;
    }

    router.refresh();
    onDone();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl">
      <PaymentElement />
      {error ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
        >
          {submitting ? 'Saving…' : 'Save card'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex items-center justify-center px-4 py-2.5 text-zinc-700 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium rounded transition-colors"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
