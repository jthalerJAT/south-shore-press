'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Menu, X, Search, User } from 'lucide-react';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';
import { cn } from '@/lib/utils';

/**
 * v1-style 3-zone masthead, light theme:
 *   Top utility row    — date · social icons · sign in · search
 *   Center brand row   — logo image + tagline below (centered)
 *   Bottom nav row     — uppercase section links with red 3px active underline
 *
 * Mobile (<lg): collapses to a single-row masthead with logo + hamburger.
 * The hamburger opens a slide-down panel with section links + utility.
 *
 * Built as a Client Component for the mobile menu state; the desktop
 * tree is mostly server-renderable HTML/CSS that hydrates instantly.
 *
 * Date is computed in render and shown to the day's granularity, so ISR
 * regeneration only invalidates the date once a day.
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

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock background scroll while the mobile panel is open (matches v1
  // and the iOS Safari quirk where the body keeps scrolling underneath).
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  // Date is generated at render. With ISR (60s on the homepage, 600s on
  // sitemap, etc.) and short cache windows, this will refresh frequently
  // enough that visitors see today's date.
  const dateLabel = formatDateLong(new Date());

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 shadow-sm">
      {/* DESKTOP: 3-zone masthead */}
      <div className="hidden lg:block">
        {/* Top utility row */}
        <div className="border-b border-zinc-100">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-9 text-xs">
            <div className="text-zinc-500 font-medium">{dateLabel}</div>
            <div className="flex items-center gap-5">
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
                    <s.icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
              <Link
                href="/signin"
                className="flex items-center gap-1 text-zinc-600 hover:text-brand-red font-semibold uppercase tracking-wider transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Sign in
              </Link>
              <SearchBar />
            </div>
          </div>
        </div>

        {/* Center brand row */}
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center">
          <Link href="/" className="inline-block group">
            <Image
              src="/logo.png"
              alt={SITE.name}
              width={400}
              height={72}
              priority
              className="h-14 w-auto mx-auto group-hover:opacity-90 transition-opacity"
            />
            <div className="mt-1 text-[11px] uppercase tracking-[0.2em] italic text-zinc-500 font-medium">
              {SITE.tagline}
            </div>
          </Link>
        </div>

        {/* Bottom nav row */}
        <nav
          aria-label="Sections"
          className="border-t border-zinc-200"
        >
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-1">
            {SITE_SECTIONS.map((section) => (
              <Link
                key={section.slug}
                href={`/${section.slug}`}
                className="px-3 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-zinc-700 hover:text-brand-red border-b-[3px] border-transparent hover:border-brand-red transition-colors"
              >
                {section.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* MOBILE: single-row masthead + hamburger */}
      <div className="lg:hidden">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" onClick={() => setMobileOpen(false)} className="block">
            <Image
              src="/logo.png"
              alt={SITE.name}
              width={300}
              height={48}
              priority
              className="h-9 w-auto"
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
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Slide-down panel */}
        <div
          className={cn(
            'overflow-hidden transition-[max-height] duration-300 ease-in-out bg-white border-t border-zinc-200',
            mobileOpen ? 'max-h-[85vh]' : 'max-h-0'
          )}
        >
          <nav aria-label="Sections (mobile)" className="px-4 py-3 flex flex-col">
            {SITE_SECTIONS.map((section) => (
              <Link
                key={section.slug}
                href={`/${section.slug}`}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-3 text-base font-semibold uppercase tracking-wide text-zinc-800 hover:text-brand-red hover:bg-zinc-50 rounded transition-colors border-b border-zinc-100 last:border-0"
              >
                {section.label}
              </Link>
            ))}
            <Link
              href="/signin"
              onClick={() => setMobileOpen(false)}
              className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
            >
              <User className="w-4 h-4" />
              Sign in
            </Link>
            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-center gap-5">
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
            <div className="mt-3 text-center text-xs text-zinc-500">
              {dateLabel}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

/** Compact search input visually similar to v1's rounded pill. Submits
 *  to /search?q=... which is a placeholder route until real search
 *  lands. */
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
          className="bg-zinc-100 hover:bg-zinc-200/70 focus:bg-white border border-transparent focus:border-zinc-300 rounded-full pl-7 pr-3 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-brand-red transition-colors"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
      </div>
    </form>
  );
}
