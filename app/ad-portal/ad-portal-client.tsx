'use client';

/** Ad Portal history box: the customer's ads, reverse-chron, with delete. */
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, FileText } from 'lucide-react';
import { adFilePublicUrl } from '@/lib/ad-files';
import type { CustomerAd } from '@/lib/queries/customer';
import { deleteCustomerAd } from './actions';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const SIZE_LABELS: Record<string, string> = {
  full: 'Full Page',
  half: 'Half Page',
  third: '1/3 Page',
  quarter: 'Quarter Page',
};

export function AdPortalClient({ ads }: { ads: CustomerAd[] }) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<CustomerAd | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    startTransition(async () => {
      const res = await deleteCustomerAd(target.id);
      if (!res.ok) setError(res.error ?? 'Could not delete.');
      else router.refresh();
    });
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500">Your Ads</h2>
        <Link
          href="/ad-portal/new"
          className="inline-flex items-center px-3 py-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold rounded transition-colors"
        >
          + Insert New Ad
        </Link>
      </div>

      {error ? (
        <div role="alert" className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="grid grid-cols-[8rem_1fr_8rem_3rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Date</div>
          <div>Copy</div>
          <div>Size</div>
          <div className="text-right">Del</div>
        </div>
        {ads.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">
            No ads yet — use &ldquo;+ Insert New Ad&rdquo; to upload your first one.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {ads.map((ad) => (
              <li
                key={ad.id}
                className="grid grid-cols-[8rem_1fr_8rem_3rem] items-center gap-3 px-4 py-3"
              >
                <div className="text-sm text-zinc-500">{fmtDate(ad.created_at)}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                    <a
                      href={adFilePublicUrl(ad.storage_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand-red hover:underline truncate"
                    >
                      {ad.file_name || 'Ad copy'}
                    </a>
                  </div>
                  {ad.notes ? (
                    <p className="mt-0.5 text-xs text-zinc-500 truncate">{ad.notes}</p>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">
                  {ad.copy_size ? SIZE_LABELS[ad.copy_size] ?? ad.copy_size : '—'}
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setConfirmTarget(ad)}
                    disabled={isPending}
                    className="inline-flex items-center justify-center w-8 h-8 rounded border border-zinc-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label="Delete ad"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-900">Delete this ad?</h3>
            <p className="mt-1 text-sm text-zinc-600">
              &ldquo;{confirmTarget.file_name || 'Ad copy'}&rdquo; will be permanently removed.
            </p>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded transition-colors"
              >
                Delete Ad
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
