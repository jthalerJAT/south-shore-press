'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SignOutButton } from './sign-out-button';

type User = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'reader' | 'journalist' | 'editor' | 'admin' | 'master admin';
  customerRoles?: Array<'advertiser' | 'legal'>;
};

/**
 * Top-right masthead chip. Auth-aware but rendered as a Client Component
 * so the surrounding page can stay ISR-cached.
 *
 * Initial paint = anonymous "Sign In" — matches SSR output so React
 * doesn't trip on hydration. Then we fetch /api/me to find out who the
 * user is. If they're logged in we swap to the role-aware menu:
 *
 *   Reader:        Hi, [Name] (→ /account) · Sign Out
 *   Journalist:    Story Editor · Hi, [Name] · Sign Out
 *   Editor/Admin:  Story Editor · Editor Portal · Hi, [Name] · Sign Out
 *
 * "Hi, [Name]" links to /account so the user can edit profile + payment.
 * "Story Editor" → /portal  (journalist and up)
 * "Editor Portal" → /portal/all  (editors + admins; the all-stories table)
 */
export function AuthChip({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  // Refetch on every navigation. The App Router keeps the root layout
  // (and therefore this header) mounted across SPA navigations, so
  // without a pathname dep the chip would never refresh after sign-in
  // or sign-out. /api/me is a tiny cookie-only check, no caching.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setUser(data.user ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Anonymous OR still loading — show Sign In. Same markup for both so
  // the SSR-rendered HTML matches the first client paint.
  if (!loaded || !user) {
    if (variant === 'mobile') {
      return (
        <Link
          href="/signin"
          className="block w-full text-center px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
        >
          Sign In
        </Link>
      );
    }
    return (
      <div className="flex items-center">
        <Link
          href="/signin"
          className="inline-flex items-center border border-zinc-900 px-4 py-2 text-[11px] uppercase tracking-widest font-bold text-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Reader: no portal links — just account + sign-out
  // Journalist: Story Editor link
  // Editor+: Story Editor + Editor Portal links
  const isJournalistTier =
    user.role === 'journalist' ||
    user.role === 'editor' ||
    user.role === 'admin' ||
    user.role === 'master admin';
  const isEditor =
    user.role === 'editor' ||
    user.role === 'admin' ||
    user.role === 'master admin';
  // Customer portals — advertiser / legal credentials, granted on the
  // Credentials page. Shown where an admin sees the Editor Portal link.
  const isAdvertiser = user.customerRoles?.includes('advertiser') ?? false;
  const isLegalCustomer = user.customerRoles?.includes('legal') ?? false;
  const firstName =
    user.displayName?.split(/\s+/)[0] ?? user.email.split('@')[0];

  if (variant === 'mobile') {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs text-zinc-500 text-center">
          Signed in as <span className="font-medium text-zinc-900">{firstName}</span>
        </div>
        {isJournalistTier ? (
          <Link
            href="/portal"
            className="block w-full text-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
          >
            Story Editor
          </Link>
        ) : null}
        {isEditor ? (
          <Link
            href="/portal/all"
            className="block w-full text-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-zinc-900 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            Editor Portal
          </Link>
        ) : null}
        {isAdvertiser ? (
          <Link
            href="/ad-portal"
            className="block w-full text-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-zinc-900 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            Ad Portal
          </Link>
        ) : null}
        {isLegalCustomer ? (
          <Link
            href="/legal-portal"
            className="block w-full text-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-zinc-900 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
          >
            Legal Portal
          </Link>
        ) : null}
        <Link
          href="/account"
          className="block w-full text-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-zinc-900 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors"
        >
          My Account
        </Link>
        <SignOutButton className="block w-full text-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors disabled:opacity-60" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-widest font-bold text-zinc-700">
      {isJournalistTier ? (
        <Link
          href="/portal"
          className="hover:text-brand-red transition-colors"
        >
          Story Editor
        </Link>
      ) : null}
      {isEditor ? (
        <Link
          href="/portal/all"
          className="hover:text-brand-red transition-colors"
        >
          Editor Portal
        </Link>
      ) : null}
      {isAdvertiser ? (
        <Link href="/ad-portal" className="hover:text-brand-red transition-colors">
          Ad Portal
        </Link>
      ) : null}
      {isLegalCustomer ? (
        <Link href="/legal-portal" className="hover:text-brand-red transition-colors">
          Legal Portal
        </Link>
      ) : null}
      <Link
        href="/account"
        className="font-normal text-zinc-500 normal-case tracking-normal hover:text-brand-red transition-colors"
        aria-label="My account"
      >
        Hi, {firstName}
      </Link>
      <SignOutButton className="inline-flex items-center border border-zinc-900 px-4 py-2 text-[11px] uppercase tracking-widest font-bold text-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors disabled:opacity-60" />
    </div>
  );
}
