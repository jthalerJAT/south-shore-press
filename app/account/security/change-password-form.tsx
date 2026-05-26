'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changePasswordAction, type ChangePasswordState } from './actions';

const initialState: ChangePasswordState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      <Field
        label="Current password"
        name="current_password"
        required
        autoComplete="current-password"
      />
      <Field
        label="New password"
        name="new_password"
        required
        autoComplete="new-password"
        minLength={8}
        help="At least 8 characters"
      />
      <Field
        label="Confirm new password"
        name="confirm_password"
        required
        autoComplete="new-password"
        minLength={8}
      />

      {state.error ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div
          role="status"
          className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2"
        >
          Password updated.
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  required = false,
  autoComplete,
  minLength,
  help,
}: {
  label: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  help?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
      {help ? <p className="mt-1 text-xs text-zinc-500">{help}</p> : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 self-start inline-flex items-center justify-center px-4 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
    >
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}
