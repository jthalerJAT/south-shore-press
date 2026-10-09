'use client';

/**
 * Site-wide page-view beacon for the portal's Traffic Stats tile. Mounted in
 * the root layout; fires once per pathname (so client-side navigations count
 * too) for PUBLIC pages only — portal, account, auth, and print surfaces are
 * staff traffic and don't belong in readership numbers. Mirrors the story
 * ViewTracker's sendBeacon-with-fetch-fallback pattern.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const EXCLUDED_PREFIXES = [
  '/portal',
  '/account',
  '/auth',
  '/api',
  '/print',
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/legal-portal',
];

export function SiteViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    try {
      const payload = JSON.stringify({ p: 1 });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/page', payload);
      } else {
        fetch('/api/track/page', { method: 'POST', body: payload, keepalive: true }).catch(() => {});
      }
    } catch {
      /* never disturb the reader */
    }
  }, [pathname]);

  return null;
}
