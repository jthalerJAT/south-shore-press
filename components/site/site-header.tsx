'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import { HeaderClock } from './header-clock';
import { AuthChip } from './auth-chip';

// Masthead logo (Cloudinary, 3272×824 ≈ 4:1). next.config allows all https
// hosts, so no remotePatterns change needed.
const LOGO_URL =
  'https://res.cloudinary.com/dorcgqudu/image/upload/v1781562603/ssp_logo_big_cyxfxn.png';

/**
 * v1-style masthead. Desktop layout (lg+):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ EMAIL BRIEFINGS         (tagline italic)        AuthChip │
 *   │                          [   LOGO   ]                          │
 *   │ time · day, month dd, yyyy                  [SUBSCRIBE NOW]    │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ HOME · LOCAL · STATE · ... · VIDEO VAULT       [search] [socials]│
 *   ├──────────────────────────────────────────────────────────────────┤
 *
 * 3-column flex; the side columns use flex-col with justify-between to
 * push their two items to top + bottom. Center column hosts tagline +
 * logo stacked vertically.
 *
 * Mobile (<lg): collapses to logo + search + hamburger. Slide-down panel
 * exposes Email Briefings, Subscribe Now, sections, and the AuthChip.
 */

const SOCIAL_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
}> = [
  {
    href: SITE.social.x,
    label: 'X (Twitter)',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: SITE.social.youtube,
    label: 'YouTube',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    href: SITE.social.instagram,
    label: 'Instagram',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
];

// "HOME" gets prepended manually since it's not a section slug; it links
// to "/" and is the active tab when pathname === '/'.
const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  ...SITE_SECTIONS.map((s) => ({ label: s.label, href: `/${s.slug}` })),
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Lock background scroll while the mobile panel is open (iOS Safari fix).
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 shadow-sm">
      {/* DESKTOP */}
      <div className="hidden lg:block">
        {/* MAIN HEADER BOX — 4 corners + centered logo/tagline.
            py-2 (8px each side) keeps the four corner items tight
            against their closest line, matching v1. Unboxed text
            uses `leading-none` so its bounding box hugs the visible
            characters and aligns with the boxed items' edges. */}
        <div className="max-w-8xl mx-auto px-6">
          <div className="flex items-stretch py-2">
            {/* LEFT COLUMN */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <Link
                  href="/email-briefings"
                  className="text-[11px] leading-none uppercase tracking-widest font-bold text-zinc-700 hover:text-brand-red transition-colors"
                >
                  Email Briefings
                </Link>
              </div>
              <HeaderClock className="text-xs leading-none uppercase tracking-widest text-zinc-600 font-medium" />
            </div>

            {/* CENTER COLUMN — small italic serif tagline above a
                large logo. The logo dominates the center, matching v1. */}
            <div className="flex flex-col items-center justify-center px-6 shrink-0">
              <div className="font-serif text-[10px] uppercase tracking-[0.2em] italic text-zinc-500 font-medium mb-1.5 leading-none">
                {SITE.tagline}
              </div>
              <Link href="/" className="block group">
                <Image
                  src={LOGO_URL}
                  alt={SITE.name}
                  width={477}
                  height={120}
                  priority
                  className="h-[120px] w-auto group-hover:opacity-90 transition-opacity"
                />
              </Link>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex-1 flex flex-col justify-between items-end min-w-0">
              <AuthChip />
              <Link
                href="/subscribe"
                className="inline-flex items-center px-4 py-2 text-[11px] uppercase tracking-widest font-bold text-white bg-brand-red hover:bg-brand-red-dark transition-colors"
              >
                Subscribe Now
              </Link>
            </div>
          </div>
        </div>

        {/* DIVIDER */}
        <div className="border-t border-zinc-200" />

        {/* TAB ROW — nav left, search + social right */}
        <div className="max-w-8xl mx-auto px-6">
          <div className="flex items-center justify-between h-11">
            {/* No `overflow-x-auto` here on purpose — Edge / some Chrome
                builds draw scroll-affordance arrow indicators on the
                left + right edges of any overflow-auto container. On
                lg+ the nav always fits inside max-w-8xl. */}
            <nav aria-label="Sections" className="flex items-center -ml-3 min-w-0">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2.5 text-[11.5px] font-bold uppercase tracking-wider border-b-[3px] -mb-px transition-colors whitespace-nowrap',
                      isActive
                        ? 'border-brand-red text-brand-red'
                        : 'border-transparent text-zinc-700 hover:text-brand-red hover:border-brand-red'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-4 shrink-0 pl-4">
              <SearchBar />
              <div className="flex items-center gap-3" aria-label="Social">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="text-zinc-500 hover:text-brand-red transition-colors"
                  >
                    <s.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM DIVIDER (under tabs) */}
        <div className="border-t border-zinc-200" />
      </div>

      {/* MOBILE */}
      <div className="lg:hidden">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 flex items-center justify-between py-3">
          <Link href="/" onClick={() => setMobileOpen(false)} className="block">
            <Image
              src={LOGO_URL}
              alt={SITE.name}
              width={222}
              height={56}
              priority
              className="h-14 w-auto"
            />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className="p-2 text-zinc-600 hover:text-brand-red transition-colors"
            >
              <Search className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="p-2 text-zinc-700 hover:text-brand-red transition-colors"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down panel */}
        <div
          className={cn(
            'overflow-hidden transition-[max-height] duration-300 ease-in-out bg-white border-t border-zinc-200',
            mobileOpen ? 'max-h-[90vh]' : 'max-h-0'
          )}
        >
          <div className="px-4 py-3 flex flex-col gap-3">
            {/* Top utility links */}
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest font-bold text-zinc-700">
              <Link
                href="/email-briefings"
                onClick={() => setMobileOpen(false)}
                className="hover:text-brand-red transition-colors"
              >
                Email Briefings
              </Link>
              <Link
                href="/subscribe"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center px-3 py-1.5 text-white bg-brand-red hover:bg-brand-red-dark transition-colors"
              >
                Subscribe
              </Link>
            </div>

            {/* Sections */}
            <nav aria-label="Sections (mobile)" className="flex flex-col">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'px-3 py-3 text-base font-semibold uppercase tracking-wide transition-colors border-b border-zinc-100 last:border-0',
                      isActive
                        ? 'text-brand-red'
                        : 'text-zinc-800 hover:text-brand-red'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* AuthChip — adapts to mobile variant */}
            <div className="pt-2">
              <AuthChip variant="mobile" />
            </div>

            {/* Social row */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-center gap-5">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-zinc-500 hover:text-brand-red transition-colors"
                >
                  <s.icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            {/* Clock */}
            <HeaderClock className="text-center text-[11px] uppercase tracking-widest text-zinc-500 font-medium" />
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchBar() {
  return (
    <form action="/search" method="GET" className="flex items-center">
      <label htmlFor="header-search" className="sr-only">
        Search
      </label>
      <div className="relative">
        <input
          id="header-search"
          name="q"
          type="search"
          placeholder="Search…"
          className="bg-zinc-100 hover:bg-zinc-200/70 focus:bg-white border border-transparent focus:border-zinc-300 rounded-full pl-8 pr-3 py-1.5 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-brand-red transition-colors"
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
      </div>
    </form>
  );
}
