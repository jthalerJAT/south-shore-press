'use client';

import { useMemo, useState, useTransition } from 'react';
import { Search, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setUserRolesAction } from '@/app/portal/all/credentials/actions';
import type { ProfileForCredentials } from '@/lib/queries/profiles';
import type { UserRole } from '@/lib/auth';

/**
 * Credentials table.
 *
 * - Search box filters by name + email
 * - Sortable column headers (First Name / Last Name / Email / Admin /
 *   Editor / Journalist). For role columns, sort by checked vs unchecked.
 * - Sticky thead + max-h scroller so column headers stay visible while
 *   scrolling a long user list
 * - Save button above the table; bright brand-red when there are
 *   pending changes, gray when clean
 * - On Save: confirmation modal lists every change ("Stefan gaining
 *   Editor, losing Journalist") for a single batch confirm
 * - Master admin users are shown as locked (no toggleable checkboxes,
 *   a MASTER ADMIN badge instead)
 * - Self-row is locked too — admins can't accidentally remove their
 *   own Admin role
 */

type RoleKey = 'admin' | 'editor' | 'journalist';
type SortKey = 'first' | 'last' | 'email' | RoleKey;
type SortDir = 'asc' | 'desc';

const ROLE_KEYS: ReadonlyArray<RoleKey> = ['admin', 'editor', 'journalist'];

const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Admin',
  editor: 'Editor',
  journalist: 'Journalist',
};

function splitName(displayName: string | null): {
  first: string;
  last: string;
} {
  if (!displayName) return { first: '', last: '' };
  const trimmed = displayName.trim();
  if (!trimmed) return { first: '', last: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return { first, last };
}

function normalize(raw: string): string {
  return raw.toLowerCase().replace(/_/g, ' ').trim();
}

function isMasterAdmin(roles: ReadonlyArray<string>): boolean {
  return roles.some((r) => normalize(r) === 'master admin');
}

export function CredentialsTable({
  initialProfiles,
  currentUserId,
  currentUserRoles,
}: {
  initialProfiles: ProfileForCredentials[];
  currentUserId: string;
  /** Viewer's roles — drives the hierarchy locks (master admin sees
   *  more rows as editable than a regular admin does). */
  currentUserRoles: UserRole[];
}) {
  const viewerIsMaster = currentUserRoles.includes('master admin');
  // Draft state: per-profile-id Set of currently-checked roles. Local
  // state we manipulate while the admin toggles checkboxes; on Save we
  // diff against original and call the server action for each change.
  const [draft, setDraft] = useState<Map<string, Set<RoleKey>>>(() => {
    const m = new Map<string, Set<RoleKey>>();
    for (const p of initialProfiles) {
      const granted = new Set<RoleKey>();
      for (const r of p.roles ?? []) {
        const n = normalize(r);
        if (n === 'admin' || n === 'editor' || n === 'journalist') {
          granted.add(n as RoleKey);
        }
      }
      m.set(p.id, granted);
    }
    return m;
  });

  const [searchQ, setSearchQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pre-compute name split, master flag, and per-row / per-cell lock
  // state once. Lock rules mirror server-side canManageUser /
  // canManageRole (see lib/auth.ts):
  //   - master admin row: fully locked (only SQL can change master admin)
  //   - admin row + viewer is not master admin: fully locked
  //   - editor/journalist row + viewer is regular admin: Admin checkbox
  //     locked, Editor/Journalist editable
  //   - self row: fully locked (no self-edit)
  const enriched = useMemo(() => {
    return initialProfiles.map((p) => {
      const { first, last } = splitName(p.display_name);
      const master = isMasterAdmin(p.roles ?? []);
      const isAdminRow = (p.roles ?? []).some(
        (r) => normalize(r) === 'admin'
      );
      const isSelf = p.id === currentUserId;

      // Row-level lock — true if NO cell on this row is editable
      const rowLocked = isSelf || master || (isAdminRow && !viewerIsMaster);

      const originalRoles = new Set<RoleKey>();
      for (const r of p.roles ?? []) {
        const n = normalize(r);
        if (n === 'admin' || n === 'editor' || n === 'journalist') {
          originalRoles.add(n as RoleKey);
        }
      }

      // Per-role disabled map
      const roleDisabled: Record<RoleKey, boolean> = {
        admin: rowLocked || !viewerIsMaster,
        editor: rowLocked,
        journalist: rowLocked,
      };

      // Lock badge to show next to the email (most specific reason wins)
      let lockBadge: string | null = null;
      if (master) lockBadge = 'MASTER ADMIN';
      else if (isSelf) lockBadge = 'YOU';
      else if (isAdminRow && !viewerIsMaster) lockBadge = 'ADMIN — MASTER ONLY';

      return {
        ...p,
        first,
        last,
        master,
        isAdminRow,
        isSelf,
        rowLocked,
        roleDisabled,
        lockBadge,
        originalRoles,
      };
    });
  }, [initialProfiles, currentUserId, viewerIsMaster]);

  // Diff: figure out which profiles have unsaved changes vs original
  const changes = useMemo(() => {
    type Change = {
      id: string;
      label: string;
      gained: RoleKey[];
      lost: RoleKey[];
      finalRoles: RoleKey[];
    };
    const list: Change[] = [];
    for (const p of enriched) {
      if (p.rowLocked) continue; // locked rows can't change at all
      const original = p.originalRoles;
      const next = draft.get(p.id) ?? new Set<RoleKey>();
      const gained: RoleKey[] = [];
      const lost: RoleKey[] = [];
      for (const r of ROLE_KEYS) {
        // Skip role-level locks too: if this specific cell isn't
        // editable, any diff is from an out-of-band source we ignore.
        if (p.roleDisabled[r]) continue;
        if (next.has(r) && !original.has(r)) gained.push(r);
        if (!next.has(r) && original.has(r)) lost.push(r);
      }
      if (gained.length === 0 && lost.length === 0) continue;
      const label =
        p.display_name?.trim() ||
        `${p.first} ${p.last}`.trim() ||
        p.email;
      list.push({
        id: p.id,
        label,
        gained,
        lost,
        finalRoles: Array.from(next),
      });
    }
    return list;
  }, [enriched, draft]);

  const hasChanges = changes.length > 0;

  function toggleRole(profileId: string, role: RoleKey) {
    setDraft((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(profileId) ?? []);
      if (current.has(role)) current.delete(role);
      else current.add(role);
      next.set(profileId, current);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // For role columns default to "checked first" (desc); for text
      // columns default to A→Z (asc).
      setSortDir(ROLE_KEYS.includes(key as RoleKey) ? 'desc' : 'asc');
    }
  }

  // Filter + sort the visible list.
  const visible = useMemo(() => {
    let rows = enriched;
    const needle = searchQ.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((p) =>
        [p.first, p.last, p.email, p.display_name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'first') cmp = a.first.localeCompare(b.first);
      else if (sortKey === 'last') cmp = a.last.localeCompare(b.last);
      else if (sortKey === 'email') cmp = a.email.localeCompare(b.email);
      else {
        // Role column: 1 if checked (in draft), 0 if not. Sort asc =
        // unchecked first; desc = checked first.
        const aHas = (draft.get(a.id)?.has(sortKey as RoleKey) ? 1 : 0) +
          (a.master ? 0.5 : 0); // master admins float to the top of "checked"
        const bHas = (draft.get(b.id)?.has(sortKey as RoleKey) ? 1 : 0) +
          (b.master ? 0.5 : 0);
        cmp = aHas - bHas;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [enriched, searchQ, sortKey, sortDir, draft]);

  function applyChanges() {
    setConfirmOpen(false);
    setError(null);
    startTransition(async () => {
      const errors: string[] = [];
      for (const change of changes) {
        const res = await setUserRolesAction(change.id, change.finalRoles);
        if (res.error) {
          errors.push(`${change.label}: ${res.error}`);
        }
      }
      if (errors.length > 0) {
        setError(errors.join(' · '));
      }
      // Note: we don't need to update local state here because the
      // page will be revalidated and the new initialProfiles will
      // flow through on the next render. The user sees the saved
      // state immediately because the optimistic toggle already
      // updated local state.
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      {/* Top bar: search + Save */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by name or email…"
            className="block w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500">
            {hasChanges
              ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}`
              : 'No changes'}
          </div>
          <button
            type="button"
            disabled={!hasChanges || isPending}
            onClick={() => setConfirmOpen(true)}
            className={cn(
              'px-5 py-2 text-sm font-bold uppercase tracking-widest rounded transition-colors',
              hasChanges
                ? 'bg-brand-red hover:bg-brand-red-dark text-white shadow-sm'
                : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
            )}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-zinc-200 rounded-lg">
        <div className="max-h-[65vh] overflow-y-auto ssp-scroll">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
              <tr>
                <SortableTh
                  label="First Name"
                  k="first"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortableTh
                  label="Last Name"
                  k="last"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortableTh
                  label="Email"
                  k="email"
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                {ROLE_KEYS.map((rk) => (
                  <SortableTh
                    key={rk}
                    label={ROLE_LABELS[rk]}
                    k={rk}
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    className="w-28 text-center"
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No users match.
                  </td>
                </tr>
              ) : (
                visible.map((p) => {
                  const currentRoles = draft.get(p.id) ?? new Set<RoleKey>();
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        'hover:bg-zinc-50 transition-colors',
                        p.rowLocked && 'bg-zinc-50/50'
                      )}
                    >
                      <td className="px-4 py-3 text-zinc-900">{p.first || '—'}</td>
                      <td className="px-4 py-3 text-zinc-900">{p.last || '—'}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="flex items-center gap-2">
                          <span>{p.email}</span>
                          {p.lockBadge ? (
                            <span
                              className={cn(
                                'inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold rounded',
                                p.master
                                  ? 'bg-brand-red text-white'
                                  : p.isSelf
                                    ? 'bg-zinc-700 text-white'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                              )}
                            >
                              {p.lockBadge}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {ROLE_KEYS.map((rk) => {
                        const cellDisabled = p.roleDisabled[rk];
                        return (
                          <td key={rk} className="px-4 py-3 text-center">
                            <RoleCheckbox
                              checked={
                                cellDisabled
                                  ? p.master ||
                                    p.originalRoles.has(rk) ||
                                    false
                                  : currentRoles.has(rk)
                              }
                              disabled={cellDisabled}
                              onChange={() => toggleRole(p.id, rk)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen ? (
        <ConfirmModal
          changes={changes}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={applyChanges}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

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
          className?.includes('text-center') && 'justify-center',
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

function RoleCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 border-2 rounded transition-colors',
        disabled
          ? checked
            ? 'border-zinc-300 bg-zinc-200 cursor-not-allowed'
            : 'border-zinc-200 bg-zinc-100 cursor-not-allowed'
          : checked
            ? 'border-brand-red bg-brand-red cursor-pointer'
            : 'border-zinc-300 bg-white hover:border-brand-red cursor-pointer'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      {checked ? (
        <Check
          className={cn(
            'w-4 h-4',
            disabled ? 'text-zinc-500' : 'text-white'
          )}
        />
      ) : null}
    </label>
  );
}

function ConfirmModal({
  changes,
  onCancel,
  onConfirm,
}: {
  changes: Array<{ id: string; label: string; gained: RoleKey[]; lost: RoleKey[] }>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credentials-confirm-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-200">
          <h2
            id="credentials-confirm-title"
            className="font-headline text-xl font-bold text-zinc-900"
          >
            Confirm credential changes
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Review the {changes.length} change{changes.length === 1 ? '' : 's'} below. This action takes effect immediately.
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto ssp-scroll divide-y divide-zinc-100">
          {changes.map((c) => (
            <li key={c.id} className="px-6 py-3 text-sm">
              <div className="font-medium text-zinc-900">{c.label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {c.gained.map((r) => (
                  <span
                    key={`g-${r}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    + {ROLE_LABELS[r]}
                  </span>
                ))}
                {c.lost.map((r) => (
                  <span
                    key={`l-${r}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200"
                  >
                    − {ROLE_LABELS[r]}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-end gap-3 bg-zinc-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold uppercase tracking-widest text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
