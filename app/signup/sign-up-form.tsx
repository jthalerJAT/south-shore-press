'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { signUpAction, type SignUpState } from './actions';
import { PhoneField } from '@/components/ui/phone-field';

const initialState: SignUpState = { error: null, success: false };

/**
 * Reader signup form. Calls signUpAction; on success, switches to a
 * "check your email" panel rather than redirecting (the user can't sign
 * in until they click the confirm link, so a redirect would be
 * misleading).
 *
 * Card collection is intentionally NOT here — see HANDOFF.md. The user
 * adds a card on /account → Payment after their first sign-in. This is
 * because Supabase email-confirmation gates the auth session we'd need
 * to call /api/payments/setup-intent.
 */
export function SignUpForm({ next: _next }: { next: string }) {
  const [state, formAction] = useFormState(signUpAction, initialState);

  if (state.success) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <h2 className="font-headline text-2xl font-bold text-emerald-900">
          Check your email
        </h2>
        <p className="mt-3 text-sm text-emerald-800">
          We sent you a confirmation link. Click it to activate your account,
          then sign in.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block px-4 py-2 text-sm font-bold uppercase tracking-wider text-white bg-brand-red hover:bg-brand-red-dark rounded"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name" name="first_name" required autoComplete="given-name" />
        <Field label="Last name" name="last_name" required autoComplete="family-name" />
      </div>

      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <PhoneField label="Phone" name="phone" />

      <div>
        <p className="text-sm font-medium text-zinc-700">
          Mailing address <span className="font-normal text-zinc-400">(optional)</span>
        </p>
        <p className="text-xs text-zinc-500">
          Only needed if you subscribe to the printed paper — you can add it later.
        </p>
      </div>
      <Field label="Street address" name="street_address" autoComplete="street-address" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="City" name="city" autoComplete="address-level2" />
        <Field label="State" name="state" autoComplete="address-level1" />
        <Field label="ZIP" name="zip_code" autoComplete="postal-code" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          help="At least 8 characters"
        />
        <Field
          label="Confirm password"
          name="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
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

      <TurnstileWidget />
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
  minLength,
  help,
}: {
  label: string;
  name: string;
  type?: string;
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
        type={type}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
      {help ? <p className="mt-1 text-xs text-zinc-500">{help}</p> : null}
    </div>
  );
}

/**
 * Cloudflare Turnstile bot check — renders only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Turnstile auto-renders any
 * `.cf-turnstile` element once its script loads and injects a hidden
 * `cf-turnstile-response` input into the surrounding form; signUpAction
 * forwards that token to Supabase (which verifies it when CAPTCHA
 * protection is enabled in the Supabase Auth settings).
 */
function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!siteKey) return;
    if (document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile"]')) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }, [siteKey]);
  if (!siteKey) return null;
  return <div className="cf-turnstile" data-sitekey={siteKey} />;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center justify-center px-4 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
    >
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  );
}
