import type { ChargeRow } from '@/lib/stripe/charges';

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatusBadge({ status, refunded }: { status: ChargeRow['status']; refunded: boolean }) {
  const label = refunded ? 'Refunded' : status.charAt(0).toUpperCase() + status.slice(1);
  const styles = refunded
    ? 'bg-zinc-100 text-zinc-600'
    : status === 'succeeded'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'pending'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

/** Payment History — a simple list of charges (date, amount, status). No
 *  receipt links, per the agreed scope. */
export function PaymentHistoryTable({ charges }: { charges: ChargeRow[] }) {
  if (charges.length === 0) {
    return (
      <p className="text-sm text-zinc-500 max-w-xl">
        No payments yet. Charges will appear here after your first subscription
        renews or is purchased.
      </p>
    );
  }

  return (
    <div className="max-w-xl overflow-hidden rounded border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium text-right">Amount</th>
            <th className="px-4 py-2 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {charges.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                {formatDate(c.created)}
              </td>
              <td className="px-4 py-3 text-zinc-600">{c.description ?? 'Subscription'}</td>
              <td className="px-4 py-3 text-right font-medium text-zinc-900 whitespace-nowrap">
                {formatAmount(c.amount, c.currency)}
              </td>
              <td className="px-4 py-3 text-right">
                <StatusBadge status={c.status} refunded={c.refunded} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
