'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowUp, ArrowDown, Check, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setUserRolesAction, deleteUserAction } from '@/app/portal/all/credentials/actions';
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

type RoleKey = 'admin' | 'editor' | 'journalist' | 'advertiser' | 'legal';
type SortKey = 'first' | 'last' | 'email' | RoleKey;
type SortDir = 'asc' | 'desc';

const ROLE_KEYS: ReadonlyArray<RoleKey> = [
  'admin',
  'editor',
  'journalist',
  'advertiser',
  'legal',
];
/** Customer credentials — gate the Ad / Legal portals, no editorial power. */
const CUSTOMER_KEYS: ReadonlyArray<RoleKey> = ['advertiser', 'legal'];

const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Admin',
  editor: 'Editor',
  journalist: 'Journalist',
  advertiser: 'Advertiser',
  legal: 'Legal',
};

function isRoleKey(n: string): n is RoleKey {
  return (ROLE_KEYS as ReadonlyArray<string>).includes(n);
}

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
  adClients = [],
}: {
  initialProfiles: ProfileForCredentials[];
  currentUserId: string;
  /** Viewer's roles — drives the hierarchy locks (master admin sees
   *  more rows as editable than a regular admin does). */
  currentUserRoles: UserRole[];
  /** Ad Database client files — the "Link User to Advertiser File" options. */
  adClients?: Array<{ id: string; business_name: string }>;
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
        if (isRoleKey(n)) granted.add(n);
      }
      m.set(p.id, granted);
    }
    return m;
  });

  const [searchQ, setSearchQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
        if (isRoleKey(n)) originalRoles.add(n);
      }

      // Per-role disabled map. Customer credentials (advertiser / legal)
      // are toggleable by any admin — only the row-level locks apply.
      const roleDisabled: Record<RoleKey, boolean> = {
        admin: rowLocked || !viewerIsMaster,
        editor: rowLocked,
        journalist: rowLocked,
        advertiser: rowLocked,
        legal: rowLocked,
      };

      // Badge to show next to the email. Lock badges win when a row is
      // locked; otherwise a READER tag flags self-signed-up users who
      // haven't been promoted to any editorial role yet (informational
      // only — those rows ARE editable).
      const hasAnyEditorialRole =
        originalRoles.has('admin') ||
        originalRoles.has('editor') ||
        originalRoles.has('journalist') ||
        master;
      let lockBadge: string | null = null;
      let isReaderBadge = false;
      if (master) lockBadge = 'MASTER ADMIN';
      else if (isSelf) lockBadge = 'YOU';
      else if (isAdminRow && !viewerIsMaster) lockBadge = 'ADMIN — MASTER ONLY';
      else if (!hasAnyEditorialRole) {
        lockBadge = 'READER';
        isReaderBadge = true;
      }

      // Legacy-role drift: the RLS policies (and, for empty roles[],
      // getCurrentUser) read the legacy single `role` column, so an
      // editorial value there that roles[] doesn't carry still GRANTS
      // access these checkboxes don't show. Surface it loudly — Bob
      // Chartuk kept publishing for days while this table read READER
      // (2026-07-15).
      const legacy = normalize(String(p.role ?? ''));
      const legacyDrift =
        ['journalist', 'editor', 'admin', 'master admin'].includes(legacy) &&
        !(p.roles ?? []).some((r) => normalize(r) === legacy)
          ? legacy
          : null;

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
        isReaderBadge,
        legacyDrift,
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

  // "Link User to Advertiser File" flow: users GAINING the Advertiser
  // credential without an existing linked ad_client must be linked (existing
  // file or a new one) before the batch saves. Queue them after confirm.
  const [linkQueue, setLinkQueue] = useState<Array<{ id: string; label: string }>>([]);
  const [links, setLinks] = useState<Map<string, { clientId?: string; newClientName?: string }>>(
    new Map()
  );

  function pendingAdvertiserLinks() {
    return changes.filter((c) => {
      if (!c.gained.includes('advertiser')) return false;
      const profile = enriched.find((p) => p.id === c.id);
      return !profile?.ad_client_id;
    });
  }

  function executeChanges(collected: Map<string, { clientId?: string; newClientName?: string }>) {
    setError(null);
    startTransition(async () => {
      const errors: string[] = [];
      for (const change of changes) {
        const link = collected.get(change.id);
        const res = await setUserRolesAction(
          change.id,
          change.finalRoles,
          link && (link.clientId || link.newClientName)
            ? link.clientId
              ? { clientId: link.clientId }
              : { newClientName: link.newClientName! }
            : undefined
        );
        if (res.error) {
          errors.push(`${change.label}: ${res.error}`);
        }
      }
      if (errors.length > 0) {
        setError(errors.join(' · '));
      }
      router.refresh();
      // Note: we don't need to update local state here because the
      // page will be revalidated and the new initialProfiles will
      // flow through on the next render. The user sees the saved
      // state immediately because the optimistic toggle already
      // updated local state.
    });
  }

  function applyChanges() {
    setConfirmOpen(false);
    const needing = pendingAdvertiserLinks();
    if (needing.length > 0) {
      setLinks(new Map());
      setLinkQueue(needing.map((c) => ({ id: c.id, label: c.label })));
      return; // resumes in handleLinkSubmit once every user is linked
    }
    executeChanges(new Map());
  }

  function handleLinkSubmit(link: { clientId?: string; newClientName?: string }) {
    const [current, ...rest] = linkQueue;
    const nextLinks = new Map(links);
    nextLinks.set(current.id, link);
    setLinks(nextLinks);
    setLinkQueue(rest);
    if (rest.length === 0) {
      executeChanges(nextLinks);
    }
  }

  function applyDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setError(null);
    startTransition(async () => {
      const res = await deleteUserAction(target.id);
      if (res.error) {
        setError(`${target.label}: ${res.error}`);
        return;
      }
      router.refresh();
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
            {isPending ? 'Saving…' : 'Save Status'}
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
                <th
                  className="w-24 px-4 py-2.5 text-center font-semibold text-zinc-700"
                  title="Every account holds the Reader credential — it can never be revoked, only the whole account deleted."
                >
                  Reader
                </th>
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
                <th className="w-16 px-4 py-2.5 text-center font-semibold text-zinc-700">
                  <span className="sr-only">Delete account</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
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
                                    : p.isReaderBadge
                                      ? 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                              )}
                            >
                              {p.lockBadge}
                            </span>
                          ) : null}
                          {p.legacyDrift ? (
                            <span
                              title={`The database's legacy role column still says "${p.legacyDrift}" — the site and its security policies honor THAT when no roles are checked, so this user still has ${p.legacyDrift} access. Grant any role, save, revoke it, and save again to clear it (or reset via SQL for a master admin).`}
                              className="inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold rounded bg-red-600 text-white"
                            >
                              ⚠ Legacy access: {p.legacyDrift}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-center"
                        title="Every account holds the Reader credential — read the site, manage their own profile. It can never be revoked; delete the account to remove the user entirely."
                      >
                        <RoleCheckbox checked disabled />
                      </td>
                      {ROLE_KEYS.map((rk) => {
                        const cellDisabled = p.roleDisabled[rk];
                        return (
                          <td key={rk} className="px-4 py-3 text-center">
                            <RoleCheckbox
                              checked={
                                cellDisabled
                                  ? // Master admin implies every EDITORIAL role;
                                    // customer credentials show their true state.
                                    (p.master && !CUSTOMER_KEYS.includes(rk)) ||
                                    p.originalRoles.has(rk)
                                  : currentRoles.has(rk)
                              }
                              disabled={cellDisabled}
                              onChange={() => toggleRole(p.id, rk)}
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={p.rowLocked || isPending}
                          onClick={() =>
                            setDeleteTarget({
                              id: p.id,
                              email: p.email,
                              label:
                                p.display_name?.trim() ||
                                `${p.first} ${p.last}`.trim() ||
                                p.email,
                            })
                          }
                          title={
                            p.rowLocked
                              ? 'This account is locked (self, master admin, or admin visible to a non-master viewer).'
                              : 'Delete this account entirely'
                          }
                          className={cn(
                            'inline-flex items-center justify-center w-7 h-7 rounded transition-colors',
                            p.rowLocked || isPending
                              ? 'text-zinc-300 cursor-not-allowed'
                              : 'text-zinc-400 hover:text-white hover:bg-red-600'
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
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

      {/* Delete-account modal */}
      {deleteTarget ? (
        <DeleteModal
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={applyDelete}
        />
      ) : null}

      {/* Link-to-advertiser-file modal (one per user gaining Advertiser) */}
      {linkQueue.length > 0 ? (
        <LinkAdvertiserModal
          key={linkQueue[0].id}
          userLabel={linkQueue[0].label}
          adClients={adClients}
          onCancel={() => {
            setLinkQueue([]);
            setError('Save cancelled — advertiser credential requires a linked file.');
          }}
          onSubmit={handleLinkSubmit}
        />
      ) : null}
    </div>
  );
}

function LinkAdvertiserModal({
  userLabel,
  adClients,
  onCancel,
  onSubmit,
}: {
  userLabel: string;
  adClients: Array<{ id: string; business_name: string }>;
  onCancel: () => void;
  onSubmit: (link: { clientId?: string; newClientName?: string }) => void;
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [clientId, setClientId] = useState('');
  const [newName, setNewName] = useState('');
  const canSubmit = mode === 'existing' ? Boolean(clientId) : Boolean(newName.trim());
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200">
          <h2 className="font-headline text-xl font-bold text-zinc-900">
            Link User to Advertiser File
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            <span className="font-medium">{userLabel}</span> is being granted the Advertiser
            credential. Their uploads will be filed under the Ad Database client you choose.
          </p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
            />
            Select an existing advertiser file
          </label>
          {mode === 'existing' ? (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
            >
              <option value="">Choose a client…</option>
              {adClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} />
            Create a new advertiser file
          </label>
          {mode === 'new' ? (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Business name"
              className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          ) : null}
        </div>
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
            disabled={!canSubmit}
            onClick={() =>
              onSubmit(mode === 'existing' ? { clientId } : { newClientName: newName.trim() })
            }
            className="px-5 py-2 text-sm font-bold uppercase tracking-widest text-white bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 rounded transition-colors"
          >
            Link &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  target,
  onCancel,
  onConfirm,
}: {
  target: { id: string; label: string; email: string };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credentials-delete-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200">
          <h2
            id="credentials-delete-title"
            className="font-headline text-xl font-bold text-zinc-900"
          >
            Delete {target.label}&rsquo;s account?
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            This permanently removes <span className="font-medium">{target.email}</span> from the
            system — sign-in, profile, and all credentials. Their published stories stay on the
            site (with no linked account). This cannot be undone.
          </p>
        </div>
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>
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
  const title =
    changes.length === 1
      ? `Are you sure you want to change ${changes[0].label}'s credentials?`
      : `Are you sure you want to change credentials for ${changes.length} users?`;

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
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Review the change{changes.length === 1 ? '' : 's'} below. This takes effect immediately.
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
            className="px-4 py-2 text-sm font-bold uppercase tracking-widest text-zinc-700 border border-zinc-300 hover:bg-white rounded transition-colors"
          >
            No
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold uppercase tracking-widest text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
