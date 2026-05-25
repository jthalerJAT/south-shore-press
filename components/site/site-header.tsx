'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, Search, User } from 'lucide-react';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';
import { cn } from '@/lib/utils';

/**
 * Sticky site header.
 *   - Brand wordmark (left), section nav (center on desktop, hamburger on
 *     mobile), search + Sign-in (right).
 *   - Mobile: hamburger opens a full-width slide-down panel with all nav
 *     items stacked. Body scroll locks while open.
 *   - Auto-closes when route changes (the hamburger Link onClick handler).
 *
 * Built as a single Client Component because the mobile menu needs local
 * `useState`. The footprint is small so the client-bundle hit is fine.
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock background scroll when the mobile panel is open. Without this, iOS
  // Safari lets the body scroll behind the overlay and the masthead drifts.
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
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row: brand + actions + hamburger */}
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex flex-col leading-none group"
            onClick={() => setMobileOpen(false)}
          >
            <span className="font-headline text-xl sm:text-2xl font-bold text-brand-red tracking-tight group-hover:text-brand-red-dark transition-colors">
              {SITE.name}
            </span>
            <span className="hidden sm:block text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
              {SITE.tagline}
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/search"
              aria-label="Search"
              className="p-2 text-zinc-600 hover:text-brand-red transition-colors"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              href="/signin"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:text-brand-red transition-colors"
            >
              <User className="w-4 h-4" />
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="lg:hidden p-2 text-zinc-700 hover:text-brand-red transition-colors"
            >
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Desktop section nav — always visible on lg+, hidden below */}
        <nav
          aria-label="Sections"
          className="hidden lg:flex items-center gap-1 h-11 -mt-px border-t border-zinc-100"
        >
          {SITE_SECTIONS.map((section) => (
            <Link
              key={section.slug}
              href={`/${section.slug}`}
              className="px-3 py-2 text-sm font-medium uppercase tracking-wide text-zinc-700 hover:text-brand-red hover:bg-zinc-50 rounded transition-colors"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile slide-down panel */}
      <div
        className={cn(
          'lg:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out bg-white border-t border-zinc-200',
          mobileOpen ? 'max-h-[80vh]' : 'max-h-0'
        )}
      >
        <nav aria-label="Sections (mobile)" className="px-4 py-3 flex flex-col">
          {SITE_SECTIONS.map((section) => (
            <Link
              key={section.slug}
              href={`/${section.slug}`}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 text-base font-medium text-zinc-800 hover:text-brand-red hover:bg-zinc-50 rounded transition-colors border-b border-zinc-100 last:border-0"
            >
              {section.label}
            </Link>
          ))}
          <Link
            href="/signin"
            onClick={() => setMobileOpen(false)}
            className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
          >
            <User className="w-4 h-4" />
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
