'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfileAction, type ProfileUpdateState } from './actions';
import type { ReaderProfile } from '@/lib/queries/reader-profile';
import { PhoneField } from '@/components/ui/phone-field';

const initialState: ProfileUpdateState = { error: null, success: false };

export function ProfileForm({ profile }: { profile: ReaderProfile }) {
  const [state, formAction] = useFormState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-xl">
      <Readonly label="Email" value={profile.email} hint="Contact us to change your email." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="First name"
          name="first_name"
          required
          defaultValue={profile.first_name ?? ''}
          autoComplete="given-name"
        />
        <Field
          label="Last name"
          name="last_name"
          required
          defaultValue={profile.last_name ?? ''}
          autoComplete="family-name"
        />
      </div>

      <PhoneField label="Phone" name="phone" defaultValue={profile.phone ?? ''} />

      <Field
        label="Street address"
        name="street_address"
        defaultValue={profile.street_address ?? ''}
        autoComplete="street-address"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field
          label="City"
          name="city"
          defaultValue={profile.city ?? ''}
          autoComplete="address-level2"
        />
        <Field
          label="State"
          name="state"
          defaultValue={profile.state ?? ''}
          autoComplete="address-level1"
        />
        <Field
          label="ZIP"
          name="zip_code"
          defaultValue={profile.zip_code ?? ''}
          autoComplete="postal-code"
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
      {state.success ? (
        <div
          role="status"
          className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2"
        >
          Profile saved.
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

function Readonly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <div className="mt-1 block w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-base text-zinc-700">
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
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
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}
