'use client';

/**
 * useEditLock + ReadOnlyBanner — one editor at a time per page.
 *
 * Opening an editor claims its scope. A second person gets `readonly` and a
 * banner naming the holder; their editor is wrapped in a disabled fieldset so
 * nothing can be typed or saved. The claim is released on unload and expires
 * after an hour without a heartbeat (see lib/newspaper/edit-lock.ts).
 *
 * While the lock table is missing (migration 051 unapplied) every caller gets
 * 'editing' — the pre-lock behaviour.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LOCK_HEARTBEAT_MS,
  describeSince,
  type LockHolder,
  type LockState,
} from '@/lib/newspaper/edit-lock';

const ENDPOINT = '/api/newspaper/edit-lock';

export type EditLock = {
  /** True while the first claim is in flight — editors stay disabled until we
   *  know, so a late "someone else has it" can't arrive after you've typed. */
  checking: boolean;
  readOnly: boolean;
  holder: LockHolder | null;
  /** The holder left and the page is free again — offer a reload. */
  freed: boolean;
};

async function post(scope: string, action: 'claim' | 'heartbeat' | 'release', keepalive = false) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope, action }),
    keepalive,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`lock ${action} failed`);
  return (await res.json()) as LockState;
}

export function useEditLock(scope: string): EditLock {
  const [checking, setChecking] = useState(true);
  const [holder, setHolder] = useState<LockHolder | null>(null);
  const [freed, setFreed] = useState(false);
  const held = useRef(false);
  const holderRef = useRef<LockHolder | null>(null);

  useEffect(() => {
    let alive = true;
    const apply = (s: LockState) => {
      if (!alive) return;
      if (s.state === 'readonly') {
        held.current = false;
        holderRef.current = s.holder;
        setHolder(s.holder);
      } else {
        // We hold it now. If we had been watching someone else, say the page
        // is free rather than silently enabling a form of stale content.
        if (holderRef.current) setFreed(true);
        held.current = true;
        holderRef.current = null;
        setHolder(null);
      }
      setChecking(false);
    };

    post(scope, 'claim')
      .then(apply)
      // A failed claim must not lock the publisher out of their own paper.
      .catch(() => alive && setChecking(false));

    const timer = setInterval(() => {
      // A read-only viewer keeps asking so it can tell you when the page frees
      // up; a holder heartbeats to keep the claim alive.
      post(scope, held.current ? 'heartbeat' : 'claim')
        .then(apply)
        .catch(() => {
          /* transient — try again next tick */
        });
    }, LOCK_HEARTBEAT_MS);

    const release = () => {
      if (held.current) void post(scope, 'release', true).catch(() => {});
    };
    window.addEventListener('pagehide', release);

    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('pagehide', release);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return { checking, readOnly: holder !== null, holder, freed };
}

/** Banner + disabled wrapper. Children render normally when you hold the lock. */
export function EditLockGate({
  lock,
  what = 'page',
  className,
  children,
}: {
  lock: EditLock;
  /** Named in the banner: "page", "Election Coverage section", … */
  what?: string;
  /** Carries the wrapped column's own layout classes (e.g. "space-y-5") so
   *  slipping the fieldset in doesn't change the editor's spacing. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      {lock.readOnly && lock.holder ? (
        <div
          role="status"
          className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong>{lock.holder.name}</strong> has had this {what} open since{' '}
          {describeSince(lock.holder.since)}. You are viewing it read-only — anything you type here
          would overwrite their work, so editing is switched off until they close it.
        </div>
      ) : null}
      {lock.freed ? (
        <div
          role="status"
          className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          This {what} is free now.{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-semibold underline"
          >
            Reload to edit it
          </button>{' '}
          — reloading picks up the changes the other editor saved.
        </div>
      ) : null}
      <fieldset
        disabled={lock.readOnly || lock.checking}
        className={['min-w-0 border-0 p-0 m-0', className].filter(Boolean).join(' ')}
      >
        {children}
      </fieldset>
    </>
  );
}
