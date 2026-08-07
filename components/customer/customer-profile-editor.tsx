'use client';

/**
 * "Edit Customer Profile" — the Billing Information block shared by the Ad
 * Portal and Legal Portal. Collapsed to a link by default; expands to the
 * form (autopopulated from signup data until first saved).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { maskPhoneInput } from '@/lib/phone';
import type { CustomerProfile } from '@/lib/queries/customer';
import { saveCustomerProfileAction } from '@/app/customer-actions';

export function CustomerProfileEditor({ profile }: { profile: CustomerProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState(profile.customer_name ?? '');
  const [contactName, setContactName] = useState(profile.contact_name ?? '');
  const [phone, setPhone] = useState(maskPhoneInput(profile.contact_phone ?? ''));
  const [email, setEmail] = useState(profile.contact_email ?? '');
  const [street, setStreet] = useState(profile.street ?? '');
  const [street2, setStreet2] = useState(profile.street2 ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [state, setState] = useState(profile.state ?? '');
  const [zip, setZip] = useState(profile.zip ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveCustomerProfileAction({
        customer_name: customerName,
        contact_name: contactName,
        contact_phone: phone,
        contact_email: email,
        street,
        street2,
        city,
        state,
        zip,
      });
      if (!res.ok) {
        setError(res.error ?? 'Could not save.');
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-semibold text-brand-red hover:underline"
      >
        {open ? 'Close Customer Profile' : 'Edit Customer Profile'}
      </button>

      {open ? (
        <div className="mt-3 max-w-xl rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-4">
            Billing Information
          </h2>
          <div className="space-y-3">
            <Field label="Customer Name" value={customerName} onChange={setCustomerName} />
            <Field label="Contact Name" value={contactName} onChange={setContactName} />
            <div>
              <label className="block text-sm font-medium text-zinc-700">Contact Phone Number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                placeholder="(xxx) xxx-xxxx"
                inputMode="numeric"
                maxLength={14}
                className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            <Field label="Contact Email Address" value={email} onChange={setEmail} type="email" />
            <Field label="Mailing Address — Street" value={street} onChange={setStreet} />
            <Field label="Street (second line)" value={street2} onChange={setStreet2} />
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
              <Field label="City" value={city} onChange={setCity} />
              <Field label="State" value={state} onChange={setState} />
              <Field label="Zip Code" value={zip} onChange={setZip} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center px-4 py-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
            >
              {isPending ? 'Saving…' : 'Save Customer Profile'}
            </button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
            {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}
