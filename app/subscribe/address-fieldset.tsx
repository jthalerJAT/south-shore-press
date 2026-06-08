'use client';

import { maskPhoneInput } from '@/lib/phone';

/** Shared shape for the delivery + billing address forms. */
export type Address = {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
};

export const EMPTY_ADDRESS: Address = {
  first_name: '',
  last_name: '',
  company: '',
  address_1: '',
  address_2: '',
  city: '',
  state: '',
  zip: '',
  email: '',
  phone: '',
};

/**
 * Controlled address form used for both Delivery and Billing. The parent
 * owns the value so it can copy delivery → billing when "Same as delivery"
 * is checked. Phone is live-masked the same way as the rest of the site.
 */
export function AddressFieldset({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: Address;
  onChange: (next: Address) => void;
}) {
  function set<K extends keyof Address>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          id={`${idPrefix}-first`}
          label="First name"
          required
          autoComplete="given-name"
          value={value.first_name}
          onChange={(v) => set('first_name', v)}
        />
        <TextInput
          id={`${idPrefix}-last`}
          label="Last name"
          required
          autoComplete="family-name"
          value={value.last_name}
          onChange={(v) => set('last_name', v)}
        />
      </div>

      <TextInput
        id={`${idPrefix}-company`}
        label="Company"
        optional
        autoComplete="organization"
        value={value.company}
        onChange={(v) => set('company', v)}
      />

      <TextInput
        id={`${idPrefix}-address1`}
        label="Address line 1"
        required
        autoComplete="address-line1"
        value={value.address_1}
        onChange={(v) => set('address_1', v)}
      />
      <TextInput
        id={`${idPrefix}-address2`}
        label="Address line 2"
        optional
        autoComplete="address-line2"
        value={value.address_2}
        onChange={(v) => set('address_2', v)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TextInput
          id={`${idPrefix}-city`}
          label="City"
          required
          autoComplete="address-level2"
          value={value.city}
          onChange={(v) => set('city', v)}
        />
        <TextInput
          id={`${idPrefix}-state`}
          label="State"
          required
          autoComplete="address-level1"
          value={value.state}
          onChange={(v) => set('state', v)}
        />
        <TextInput
          id={`${idPrefix}-zip`}
          label="ZIP code"
          required
          autoComplete="postal-code"
          inputMode="numeric"
          value={value.zip}
          onChange={(v) => set('zip', v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          id={`${idPrefix}-email`}
          label="Email address"
          required
          type="email"
          autoComplete="email"
          value={value.email}
          onChange={(v) => set('email', v)}
        />
        <div>
          <label
            htmlFor={`${idPrefix}-phone`}
            className="block text-sm font-medium text-zinc-700"
          >
            Phone number<span className="text-red-600"> *</span>
          </label>
          <input
            id={`${idPrefix}-phone`}
            name={`${idPrefix}-phone`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(xxx) xxx-xxxx"
            maxLength={14}
            value={value.phone}
            onChange={(e) => set('phone', maskPhoneInput(e.target.value))}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </div>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  optional = false,
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
        {optional ? <span className="text-zinc-400 font-normal"> (optional)</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}

/** Required-field check shared by the flow's client-side guard. Mirrors
 *  the server's missingDeliveryFields (company + address_2 optional). */
export function addressMissingFields(a: Address): string[] {
  const required: Array<[keyof Address, string]> = [
    ['first_name', 'first name'],
    ['last_name', 'last name'],
    ['address_1', 'address'],
    ['city', 'city'],
    ['state', 'state'],
    ['zip', 'ZIP code'],
    ['email', 'email'],
    ['phone', 'phone'],
  ];
  return required.filter(([k]) => !a[k].trim()).map(([, label]) => label);
}
