'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resetPasswordAction, type ResetPasswordState } from './actions';

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <p className="mt-1 text-xs text-zinc-500">At least 8 characters</p>
      </div>
      <div>
        <label htmlFor="confirm_password" className="block text-sm font-medium text-zinc-700">
          Confirm new password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}
