'use client';

import { useState } from 'react';
import { maskPhoneInput } from '@/lib/phone';
import { signUpForBriefings } from './actions';

export type BriefingDefaults = {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
};

export function BriefingForm({ defaults }: { defaults: BriefingDefaults }) {
  const [firstName, setFirstName] = useState(defaults.firstName);
  const [lastName, setLastName] = useState(defaults.lastName);
  const [street, setStreet] = useState(defaults.street);
  const [city, setCity] = useState(defaults.city);
  const [stateField, setStateField] = useState(defaults.state);
  const [zip, setZip] = useState(defaults.zip);
  const [phone, setPhone] = useState(defaults.phone);
  const [email, setEmail] = useState(defaults.email);
  const [confirmEmail, setConfirmEmail] = useState(''); // never pre-filled
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const emailsMismatch =
    confirmEmail.length > 0 && email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase();
  const canSubmit =
    !submitting &&
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    confirmEmail.trim() &&
    !emailsMismatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (emailsMismatch) {
      setError('The email addresses don’t match.');
      return;
    }
    setSubmitting(true);
    const res = await signUpForBriefings({
      firstName, lastName, street, city, state: stateField, zip, phone, email, confirmEmail,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <h2 className="font-headline text-2xl font-bold text-emerald-800">You’re signed up! 🎉</h2>
        <p className="mt-2 text-emerald-700">
          The daily South Shore Press briefing will start arriving at <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 text-left max-w-xl mx-auto space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="First name" value={firstName} onChange={setFirstName} required />
        <Field label="Last name" value={lastName} onChange={setLastName} required />
      </div>

      <Field label="Street address" value={street} onChange={setStreet} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={stateField} onChange={setStateField} />
        <Field label="ZIP" value={zip} onChange={setZip} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Phone number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
          placeholder="(xxx) xxx-xxxx"
          inputMode="numeric"
          maxLength={14}
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <Field label="Email address" value={email} onChange={setEmail} type="email" required />
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Confirm email address <span className="text-red-600">*</span>
        </label>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          required
          className={`mt-1 block w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 ${
            emailsMismatch
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-zinc-300 focus:border-brand-red focus:ring-brand-red'
          }`}
        />
        {emailsMismatch ? (
          <p className="mt-1 text-sm text-red-600">The email addresses don’t match.</p>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center px-6 py-3 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
      >
        {submitting ? 'Signing you up…' : 'Sign Up For Daily Email Briefings'}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}
