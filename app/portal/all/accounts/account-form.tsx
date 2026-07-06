'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskPhoneInput } from '@/lib/phone';
import { ACCOUNT_TYPES, isPaidAccountType } from '@/lib/account-types';
import type { Account, AccountType, AccountStatus } from '@/lib/account-types';
import { createAccount, updateAccount, type AccountInput } from './actions';

export function AccountForm({ mode, account }: { mode: 'create' | 'edit'; account?: Account }) {
  const router = useRouter();
  const [f, setF] = useState<AccountInput>({
    account_type: account?.account_type ?? 'mailer',
    status: account?.status ?? 'active',
    first_name: account?.first_name ?? '',
    last_name: account?.last_name ?? '',
    company: account?.company ?? '',
    address_1: account?.address_1 ?? '',
    address_2: account?.address_2 ?? '',
    city: account?.city ?? '',
    state: account?.state ?? '',
    zip: account?.zip ?? '',
    email: account?.email ?? '',
    phone: maskPhoneInput(account?.phone ?? ''),
    subscription_start: account?.subscription_start ?? '',
    subscription_end: account?.subscription_end ?? '',
    acs_keyline: account?.acs_keyline ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const paid = isPaidAccountType(f.account_type);

  function set<K extends keyof AccountInput>(key: K, value: AccountInput[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res =
      mode === 'create' ? await createAccount(f) : await updateAccount(account!.id, f);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    if (mode === 'create' && 'id' in res && res.id) {
      router.push('/portal/all/accounts');
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Account Type</label>
          <select
            value={f.account_type}
            onChange={(e) => set('account_type', e.target.value as AccountType)}
            className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Status</label>
          <select
            value={f.status}
            onChange={(e) => set('status', e.target.value as AccountStatus)}
            className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First Name" value={f.first_name ?? ''} onChange={(v) => set('first_name', v)} />
        <Field label="Last Name" value={f.last_name ?? ''} onChange={(v) => set('last_name', v)} />
      </div>

      <Field label="Company (optional)" value={f.company ?? ''} onChange={(v) => set('company', v)} />

      <Field label="Address Line 1" value={f.address_1 ?? ''} onChange={(v) => set('address_1', v)} />
      <Field label="Address Line 2" value={f.address_2 ?? ''} onChange={(v) => set('address_2', v)} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 sm:col-span-2">
          <Field label="City" value={f.city ?? ''} onChange={(v) => set('city', v)} />
        </div>
        <Field label="State" value={f.state ?? ''} onChange={(v) => set('state', v)} />
        <Field label="ZIP" value={f.zip ?? ''} onChange={(v) => set('zip', v)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email (optional)" value={f.email ?? ''} onChange={(v) => set('email', v)} type="email" />
        <div>
          <label className="block text-sm font-medium text-zinc-700">Phone (optional)</label>
          <input
            value={f.phone ?? ''}
            onChange={(e) => set('phone', maskPhoneInput(e.target.value))}
            placeholder="(xxx) xxx-xxxx"
            inputMode="numeric"
            maxLength={14}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </div>

      {paid ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Paid subscription
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Subscription Start</label>
            <input
              type="date"
              value={f.subscription_start ?? ''}
              onChange={(e) => set('subscription_start', e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Subscription End</label>
            <input
              type="date"
              value={f.subscription_end ?? ''}
              onChange={(e) => set('subscription_end', e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </div>
      ) : null}

      <Field
        label="ACS Keyline (optional)"
        value={f.acs_keyline ?? ''}
        onChange={(v) => set('acs_keyline', v)}
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create Account' : 'Save Account'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
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
        className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
    </div>
  );
}
