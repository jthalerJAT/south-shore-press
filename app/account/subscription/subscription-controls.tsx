'use client';

import { useFormState, useFormStatus } from 'react-dom';
import {
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  type SubActionState,
} from './actions';

const initialState: SubActionState = { error: null, success: false };

/**
 * Cancel / Resume controls for an active subscription. When a cancellation
 * is already pending (cancel_at_period_end) we show "Resume"; otherwise
 * "Cancel Subscription".
 */
export function SubscriptionControls({
  cancelAtPeriodEnd,
}: {
  cancelAtPeriodEnd: boolean;
}) {
  if (cancelAtPeriodEnd) {
    return (
      <ActionForm
        action={resumeSubscriptionAction}
        label="Resume subscription"
        pendingLabel="Resuming…"
        variant="primary"
      />
    );
  }
  return (
    <ActionForm
      action={cancelSubscriptionAction}
      label="Cancel Subscription"
      pendingLabel="Canceling…"
      variant="danger"
    />
  );
}

function ActionForm({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: (prev: SubActionState, formData: FormData) => Promise<SubActionState>;
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'danger';
}) {
  const [state, formAction] = useFormState(action, initialState);
  return (
    <form action={formAction} className="mt-4">
      <SubmitButton label={label} pendingLabel={pendingLabel} variant={variant} />
      {state.error ? (
        <div
          role="alert"
          className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {state.error}
        </div>
      ) : null}
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'danger';
}) {
  const { pending } = useFormStatus();
  const base =
    'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const styles =
    variant === 'danger'
      ? 'text-red-700 border border-red-300 hover:bg-red-50'
      : 'bg-brand-red hover:bg-brand-red-dark text-white uppercase tracking-wide';
  return (
    <button type="submit" disabled={pending} className={`${base} ${styles}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
