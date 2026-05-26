'use client';

import { useState } from 'react';
import { maskPhoneInput } from '@/lib/phone';

/**
 * Phone input with live "(xxx) xxx-xxxx" masking. Controlled component;
 * the value submitted with the form is the masked string. Server actions
 * call normalizePhoneForStorage() before persisting so the DB always
 * holds digits-only.
 *
 * Accepts any initial defaultValue (digits-only or pre-formatted) and
 * normalizes it through the mask on mount.
 */
export function PhoneField({
  label,
  name,
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState<string>(maskPhoneInput(defaultValue ?? ''));

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type="tel"
        autoComplete="tel-national"
        inputMode="numeric"
        placeholder="(xxx) xxx-xxxx"
        maxLength={14}
        required={required}
        value={value}
        onChange={(e) => setValue(maskPhoneInput(e.target.value))}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}
