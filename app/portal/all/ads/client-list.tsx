'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Folder, Trash2 } from 'lucide-react';
import type { AdClientWithCounts } from '@/lib/queries/ad-clients';
import { deleteAdClient } from './actions';

export function ClientList({
  clients,
  isAdmin,
}: {
  clients: AdClientWithCounts[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQ, setSearchQ] = useState('');

  const visible = useMemo(() => {
    const needle = searchQ.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) =>
      [c.business_name, c.contact_name ?? '', c.contact_email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [clients, searchQ]);

  function handleDelete(e: React.MouseEvent, client: AdClientWithCounts) {
    e.preventDefault();
    e.stopPropagation();
    const total = client.copy_count + client.insert_order_count + client.contract_count;
    if (
      !confirm(
        `Delete "${client.business_name}" and its ${total} file${total === 1 ? '' : 's'}? This can't be undone.`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteAdClient(client.id);
      if (!res.ok) alert(res.error ?? 'Could not delete.');
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search clients…"
          className="block w-full max-w-xs rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <Link
          href="/portal/all/ads/new"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add New Client
        </Link>
      </div>

      <div className="overflow-hidden rounded border border-zinc-200">
        <div
          className={`grid ${isAdmin ? 'grid-cols-[1fr_1fr_10rem_3rem]' : 'grid-cols-[1fr_1fr_10rem]'} items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500`}
        >
          <div>Client</div>
          <div>Contact</div>
          <div>Files</div>
          {isAdmin ? <div className="text-right">Del</div> : null}
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">
            {clients.length === 0 ? 'No clients yet — add the first one.' : 'No clients match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/all/ads/${c.id}`}
                  className={`grid ${isAdmin ? 'grid-cols-[1fr_1fr_10rem_3rem]' : 'grid-cols-[1fr_1fr_10rem]'} items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {c.business_name}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-600 truncate">
                    {c.contact_name || c.contact_email || (
                      <span className="text-zinc-400 italic">—</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {c.copy_count} copy · {c.insert_order_count} IO · {c.contract_count} contract
                  </div>
                  {isAdmin ? (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, c)}
                        disabled={isPending}
                        className="inline-flex items-center justify-center w-8 h-8 rounded border border-zinc-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Delete client"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
