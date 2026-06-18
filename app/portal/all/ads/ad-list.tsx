'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adFilePublicUrl } from '@/lib/ad-files';
import type { Ad } from '@/lib/queries/ads';
import { deleteAd } from './actions';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AdList({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent, ad: Ad) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${ad.business_name}" and all its ad runs? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteAd(ad.id);
      if (!res.ok) alert(res.error ?? 'Could not delete.');
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-600">Advertisers and their copy, newest first.</p>
        <Link
          href="/portal/all/ads/new"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
        >
          <Plus className="w-4 h-4" /> Upload New Ad
        </Link>
      </div>

      <div className="overflow-hidden rounded border border-zinc-200">
        <div className="grid grid-cols-[8rem_1fr_1fr_3rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Date</div>
          <div>Advertiser</div>
          <div>Copy</div>
          <div className="text-right">Del</div>
        </div>
        {ads.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">No ads yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {ads.map((ad) => (
              <li key={ad.id}>
                <Link
                  href={`/portal/all/ads/${ad.id}`}
                  className="grid grid-cols-[8rem_1fr_1fr_3rem] items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-sm text-zinc-500">{fmtDate(ad.created_at)}</div>
                  <div className="text-sm font-medium text-zinc-900 truncate">{ad.business_name}</div>
                  <div className="text-sm text-zinc-600 truncate">
                    {ad.copy_storage_path ? (
                      <span
                        role="link"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(adFilePublicUrl(ad.copy_storage_path!), '_blank');
                        }}
                        className="text-brand-red hover:underline"
                      >
                        {ad.copy_file_name || 'View copy'}
                      </span>
                    ) : (
                      <span className="text-zinc-400 italic">No copy</span>
                    )}
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, ad)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-zinc-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Delete ad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
