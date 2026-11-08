'use client';

/**
 * Google AdSense loader — PUBLIC pages only.
 *
 * It used to sit in the root layout as a literal tag, which loaded it on every
 * surface: the Newspaper Creator, the legal/ad portals, and — worst — the
 * /print routes that the press PDF is rendered from. Ads must never run on the
 * page that becomes the printed paper, and they have no business on staff
 * screens (2026-11-08, after AdSense approval).
 *
 * Site verification is already complete, so the tag no longer has to appear in
 * the server-rendered HTML; injecting it client-side keeps the public pages
 * statically cacheable. Mirrors SiteViewTracker's path gating.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CLIENT = 'ca-pub-2614812694388385';
const SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;

/** Staff + machine surfaces: no ads, ever. */
const EXCLUDED_PREFIXES = [
  '/portal',
  '/account',
  '/auth',
  '/api',
  '/print',
  '/ad-portal',
  '/legal-portal',
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export function isAdSurface(pathname: string | null): boolean {
  if (!pathname) return false;
  return !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AdSenseScript() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAdSurface(pathname)) return;
    if (document.querySelector(`script[src^="${SRC.split('?')[0]}"]`)) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = SRC;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }, [pathname]);

  return null;
}
