'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PaymentCardSection } from './payment-card-section';
import { PaymentHistoryTable } from './payment-history-table';
import type { ChargeRow } from '@/lib/stripe/charges';

/**
 * Two-tab Payment view: the card-on-file manager and a read-only charge
 * history. State is local; both panels get their data from the server page.
 */
export function PaymentTabs({
  hasExistingCard,
  existingLast4,
  existingBrand,
  charges,
}: {
  hasExistingCard: boolean;
  existingLast4: string | null;
  existingBrand: string | null;
  charges: ChargeRow[];
}) {
  const [tab, setTab] = useState<'method' | 'history'>('method');

  return (
    <div>
      <div
        role="tablist"
        aria-label="Payment sections"
        className="mb-6 flex gap-1 border-b border-zinc-200"
      >
        <TabButton active={tab === 'method'} onClick={() => setTab('method')}>
          Payment method
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          Payment history
        </TabButton>
      </div>

      {tab === 'method' ? (
        <PaymentCardSection
          hasExistingCard={hasExistingCard}
          existingLast4={existingLast4}
          existingBrand={existingBrand}
        />
      ) : (
        <PaymentHistoryTable charges={charges} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-brand-red text-brand-red'
          : 'border-transparent text-zinc-600 hover:text-zinc-900'
      )}
    >
      {children}
    </button>
  );
}
