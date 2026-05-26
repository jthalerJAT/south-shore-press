'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

const initialState: ForgotPasswordState = { error: null, sent: false };

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initialState);

  if (state.sent) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <p className="text-sm text-emerald-900">
          If an account exists for that email, we&apos;ve sent a password reset
          link. Check your inbox (and spam folder) for a message from us.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      {state.error ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center justify-center px-4 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
    >
      {pending ? 'Sending…' : 'Send reset link'}
    </button>
  );
}
