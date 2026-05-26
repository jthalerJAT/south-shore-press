'use client';

import { useMemo, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { SITE_SECTIONS } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';

type StatusFilter = 'all' | 'draft' | 'submitted' | 'published' | 'unpublished';
type SortKey = 'date' | 'time' | 'title' | 'byline' | 'section' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_TABS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'published', label: 'Published' },
  { key: 'unpublished', label: 'Unpublished' },
];

/**
 * "All Stories" view with full filter UX. Used in two contexts:
 *   - /portal/all       editor sees every story, all statuses (status
 *                       filter tabs visible)
 *   - /portal           journalist or editor sees their own DRAFTS only
 *                       (parent passes hideStatusFilter, so the tab
 *                       row is hidden)
 *
 * Features:
 *   - search box (matches headline / subline / byline / author)
 *   - status filter tabs (with live counts) — optional
 *   - section filter dropdown
 *   - click-to-sort column headers (asc/desc)
 *
 * Columns mirror the v1 spec: Date, Time Posted, Title, Byline,
 * Section, Status. Defaults to reverse-chronological (date desc).
 *
 * All filter + sort state lives in the URL (?q=...&status=...&section=...
 * &sort=...&dir=...) so filter views are shareable, deep-linkable, and
 * survive a page refresh. Client-side filtering of a pre-loaded list
 * works fine at the current 500-story cap on getAllStoriesForEditor;
 * if that grows we'll push the filter down into Supabase.
 */
export function AllStoriesView({
  stories,
  hideStatusFilter = false,
  emptyMessage = 'No stories match your filters.',
}: {
  stories: EditorStoryRow[];
  /** Suppress the status tab row when every story is already a single
   *  status (e.g. the journalist's drafts list). */
  hideStatusFilter?: boolean;
  /** Override the "no matches" copy — defaults to a generic filter msg. */
  emptyMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read filter + sort state from the URL (single source of truth).
  const q = searchParams.get('q') ?? '';
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter;
  const sectionFilter = searchParams.get('section') ?? 'all';
  const sortKey = (searchParams.get('sort') ?? 'date') as SortKey;
  const sortDir = (searchParams.get('dir') ?? 'desc') as SortDir;

  // Status counts always computed on the FULL set so tab counts don't
  // change as the user types in the search box.
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: stories.length,
      draft: 0,
      submitted: 0,
      published: 0,
      unpublished: 0,
    };
    for (const s of stories) {
      counts[s.status]++;
    }
    return counts;
  }, [stories]);

  // Filter + sort pipeline.
  const visible = useMemo(() => {
    let result = stories;

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (sectionFilter !== 'all') {
      result = result.filter((s) =>
        s.categories?.includes(sectionFilter)
      );
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      result = result.filter((s) => {
        const haystack = [
          s.headline,
          s.subline ?? '',
          s.byline ?? '',
          s.author?.display_name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    // Sort — make a copy so we don't mutate React's stories prop.
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.headline.localeCompare(b.headline);
          break;
        case 'byline':
          cmp = (a.byline ?? '').localeCompare(b.byline ?? '');
          break;
        case 'section':
          cmp = (a.categories?.[0] ?? '').localeCompare(
            b.categories?.[0] ?? ''
          );
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'date':
        case 'time':
        default: {
          // Date and Time both sort by the same underlying timestamp
          // (the post time). Two display columns of one data field.
          const aT = new Date(a.published_at ?? a.created_at).getTime();
          const bT = new Date(b.published_at ?? b.created_at).getTime();
          cmp = aT - bT;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [stories, q, statusFilter, sectionFilter, sortKey, sortDir]);

  /** Update a single URL search param without scrolling. Pass null/'' to
   *  clear (which collapses the URL — no ?sort=updated default noise). */
  function updateParam(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      updateParam({ dir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      // First click on a new column: pick the sensible default direction
      // (recency desc, everything else asc).
      updateParam({
        sort: key,
        dir: key === 'date' || key === 'time' ? 'desc' : 'asc',
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar: search + section dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search headlines, bylines, authors…"
            value={q}
            onChange={(e) => updateParam({ q: e.target.value })}
            className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <select
          value={sectionFilter}
          onChange={(e) => updateParam({ section: e.target.value })}
          className="text-sm border border-zinc-300 rounded px-3 py-2 bg-white focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          aria-label="Filter by section"
        >
          <option value="all">All sections</option>
          {SITE_SECTIONS.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter tabs with live counts — hidden when all stories
          are a single status (e.g. journalist's drafts list).
          No `overflow-x-auto` here on purpose — Edge / some Chrome
          builds render scroll-affordance arrows on the right side
          when overflow-auto is set; flex-wrap is safer + cleaner. */}
      {!hideStatusFilter && (
        <nav
          aria-label="Filter by status"
          className="flex flex-wrap items-center gap-1 border-b border-zinc-200"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => updateParam({ status: tab.key })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-brand-red text-brand-red'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-block min-w-[1.25rem] text-[10px] px-1.5 py-0.5 rounded font-semibold',
                    isActive
                      ? 'bg-brand-red text-white'
                      : 'bg-zinc-100 text-zinc-600'
                  )}
                >
                  {statusCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Results count */}
      <div className="text-xs text-zinc-500">
        Showing <span className="font-medium text-zinc-900">{visible.length}</span> of{' '}
        {stories.length} stories
        {(q || statusFilter !== 'all' || sectionFilter !== 'all') && (
          <button
            type="button"
            onClick={() =>
              updateParam({ q: null, status: null, section: null })
            }
            className="ml-3 text-brand-red hover:text-brand-red-dark font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-zinc-500">
          {stories.length === 0 ? emptyMessage : 'No stories match your filters.'}
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-200 rounded-lg">
          {/* Desktop table — columns mirror v1 spec exactly:
              Date | Time Posted | Title | Byline | Section | Status
              Wrapped in a max-h scroller with sticky thead so the
              column headers stay visible while editors scroll a
              long story list. */}
          <div className="hidden sm:block max-h-[65vh] overflow-y-auto ssp-scroll">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
              <tr>
                <SortableTh
                  label="Date"
                  k="date"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                  className="w-28"
                />
                <SortableTh
                  label="Time Posted"
                  k="time"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                  className="w-28"
                />
                <SortableTh
                  label="Title"
                  k="title"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortableTh
                  label="Byline"
                  k="byline"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                  className="w-40"
                />
                <SortableTh
                  label="Section"
                  k="section"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                  className="w-32"
                />
                <SortableTh
                  label="Status"
                  k="status"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                  className="w-28"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((s) => {
                const ts = s.published_at ?? s.created_at;
                const href = `/portal/edit/${s.id}`;
                // Whole-row click: navigate to the edit page. We still
                // keep the title cell as a real <Link> so keyboard users
                // can tab-and-Enter, and so the URL appears on hover.
                // onClick ignores propagation from anchors/buttons inside
                // the row so we don't double-fire.
                const onRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
                  const el = e.target as HTMLElement;
                  if (el.closest('a, button, input, select')) return;
                  router.push(href);
                };
                return (
                  <tr
                    key={s.id}
                    onClick={onRowClick}
                    className="hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">
                      {formatDate(ts)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">
                      {formatTime(ts)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={href}
                        className="font-medium text-zinc-900 hover:text-brand-red"
                      >
                        {s.headline || (
                          <span className="italic text-zinc-400">
                            (untitled)
                          </span>
                        )}
                      </Link>
                      {s.subline ? (
                        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                          {s.subline}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {s.byline ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {(s.categories ?? []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Mobile stack */}
          <ul className="sm:hidden divide-y divide-zinc-100">
            {visible.map((s) => {
              const ts = s.published_at ?? s.created_at;
              return (
                <li key={s.id}>
                  <Link
                    href={`/portal/edit/${s.id}`}
                    className="block px-4 py-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-zinc-900 line-clamp-2">
                        {s.headline || (
                          <span className="italic text-zinc-400">
                            (untitled)
                          </span>
                        )}
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                      <time>{formatDate(ts)}</time>
                      <span aria-hidden="true">·</span>
                      <time>{formatTime(ts)}</time>
                      {(s.categories?.length ?? 0) > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{(s.categories ?? []).join(', ')}</span>
                        </>
                      ) : null}
                      {s.byline ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{s.byline}</span>
                        </>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SortableTh({
  label,
  k,
  current,
  dir,
  onClick,
  className,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = current === k;
  return (
    <th className={cn('text-left font-semibold text-zinc-700', className)}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn(
          'w-full px-4 py-2.5 flex items-center gap-1 hover:text-brand-red transition-colors',
          isActive && 'text-brand-red'
        )}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <span className="w-3 h-3" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
}
