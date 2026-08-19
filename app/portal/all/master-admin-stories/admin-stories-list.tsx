'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Bot, PenLine, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SITE_SECTIONS } from '@/lib/site-config';
import type { AdminStoryRow } from '@/lib/queries/admin-stories';

type Filter = 'all' | 'drafts' | 'pushed';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function sectionLabel(slug: string | undefined): string {
  if (!slug) return '—';
  return SITE_SECTIONS.find((s) => s.slug === slug)?.label ?? slug;
}

export function AdminStoriesList({ rows }: { rows: AdminStoryRow[] }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => ({
      all: rows.length,
      drafts: rows.filter((r) => r.status === 'admin_draft').length,
      pushed: rows.filter((r) => r.status === 'pushed').length,
    }),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'drafts' && r.status !== 'admin_draft') return false;
      if (filter === 'pushed' && r.status !== 'pushed') return false;
      if (!needle) return true;
      return (
        r.headline.toLowerCase().includes(needle) ||
        (r.subline ?? '').toLowerCase().includes(needle) ||
        (r.byline ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1 text-xs">
          {(
            [
              ['all', 'All'],
              ['drafts', 'Admin Drafts'],
              ['pushed', 'Pushed to Story Editor'],
            ] as Array<[Filter, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={cn(
                'px-2.5 py-1 rounded border font-medium',
                filter === k
                  ? 'border-brand-red bg-red-50 text-brand-red'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              )}
            >
              {label} <span className="text-zinc-400">({counts[k]})</span>
            </button>
          ))}
        </div>
        <label className="ml-auto relative block">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search headline, subhead, byline…"
            className="w-72 rounded border border-zinc-300 pl-8 pr-3 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="grid grid-cols-[7rem_5rem_1fr_10rem_7rem_9rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Date</div>
          <div>Time</div>
          <div>Title</div>
          <div>Byline</div>
          <div>Section</div>
          <div>Status</div>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-400">
            {rows.length === 0
              ? 'Nothing here yet — the AI desks post new drafts each cycle, or start one with + New Story.'
              : 'No stories match.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/portal/all/master-admin-stories/${r.id}`}
                  className="grid grid-cols-[7rem_5rem_1fr_10rem_7rem_9rem] items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-sm text-zinc-500">{fmtDate(r.created_at)}</div>
                  <div className="text-xs text-zinc-500">{fmtTime(r.created_at)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.source === 'ai' ? (
                        <Bot className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-label="AI draft" />
                      ) : (
                        <PenLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-label="Admin-written" />
                      )}
                      <div className="text-sm font-medium text-zinc-900 truncate">{r.headline}</div>
                    </div>
                    {r.subline ? <div className="text-xs text-zinc-500 truncate pl-5.5">{r.subline}</div> : null}
                  </div>
                  <div className="text-sm text-zinc-700 truncate">{r.byline ?? '—'}</div>
                  <div className="text-xs text-zinc-500">{sectionLabel(r.categories?.[0])}</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded border',
                        r.status === 'pushed'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      )}
                    >
                      {r.status === 'pushed' ? 'In Story Editor' : 'Admin Draft'}
                    </span>
                    {r.status === 'pushed' && r.pushed_story_id ? (
                      <ExternalLink className="w-3 h-3 text-zinc-400" />
                    ) : null}
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
