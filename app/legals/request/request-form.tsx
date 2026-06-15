'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { PhoneField } from '@/components/ui/phone-field';
import { requestNotarizedCopyAction, type RequestState } from './actions';

const initialState: RequestState = { error: null, success: false };

export function RequestForm({
  legalId,
  defaultLegalAd,
}: {
  legalId: string;
  defaultLegalAd: string;
}) {
  const [state, formAction] = useFormState(requestNotarizedCopyAction, initialState);

  if (state.success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-6">
        <h2 className="font-headline text-lg font-bold text-emerald-900">
          Request received
        </h2>
        <p className="mt-2 text-sm text-emerald-800">
          Thank you — your request for a notarized copy has been sent to our team.
          We&apos;ll be in touch at the email you provided.
        </p>
        <Link
          href="/legals"
          className="mt-5 inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
        >
          Back to Legals
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="legal_id" value={legalId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" name="name" required autoComplete="name" />
        <Field label="Email address" name="email" type="email" required autoComplete="email" />
      </div>

      <Field label="Address" name="address" autoComplete="street-address" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhoneField label="Phone number" name="phone" />
        <Field
          label="Legal ad requested"
          name="legal_ad_requested"
          required
          defaultValue={defaultLegalAd}
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Other notes <span className="text-zinc-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
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

function Field({
  label,
  name,
  type = 'text',
  required = false,
  autoComplete,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
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
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 self-start inline-flex items-center justify-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
    >
      {pending ? 'Submitting…' : 'Request Notarized Copy'}
    </button>
  );
}
