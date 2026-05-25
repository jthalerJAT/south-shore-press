import Link from 'next/link';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';

/**
 * Server-rendered footer. No client interaction needed.
 *   - Section links (mirrors header nav so readers can jump from the bottom
 *     of an article without scrolling back up)
 *   - Brand block + tagline
 *   - Social row (X / YouTube / Instagram) — handles wired in Phase 6
 *   - Legal/utility links + copyright
 *
 * Social icons are inline SVG (no extra deps, no client JS, no FOUT).
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-brand-navy text-zinc-200">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Brand */}
          <div className="md:col-span-4">
            <div className="font-headline text-2xl font-bold text-white">
              {SITE.name}
            </div>
            <div className="mt-1 text-sm italic text-zinc-400">
              {SITE.tagline}
            </div>
            <div className="mt-6 flex items-center gap-4" aria-label="Social">
              <a
                href={SITE.social.x}
                aria-label="X (Twitter)"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {/* X / Twitter logo */}
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={SITE.social.youtube}
                aria-label="YouTube"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                  aria-hidden="true"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href={SITE.social.instagram}
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Sections */}
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Sections
            </div>
            <nav
              aria-label="Footer sections"
              className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2"
            >
              {SITE_SECTIONS.map((section) => (
                <Link
                  key={section.slug}
                  href={`/${section.slug}`}
                  className="text-sm text-zinc-300 hover:text-white transition-colors"
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Utility */}
          <div className="md:col-span-3">
            <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              About
            </div>
            <nav
              aria-label="Footer utility"
              className="mt-3 flex flex-col gap-2"
            >
              <Link
                href="/about"
                className="text-sm text-zinc-300 hover:text-white transition-colors"
              >
                About us
              </Link>
              <Link
                href="/contact"
                className="text-sm text-zinc-300 hover:text-white transition-colors"
              >
                Contact
              </Link>
              <Link
                href="/advertise"
                className="text-sm text-zinc-300 hover:text-white transition-colors"
              >
                Advertise
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-zinc-300 hover:text-white transition-colors"
              >
                Privacy
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div>
            &copy; {year} {SITE.publisher}. All rights reserved.
          </div>
          <div>Long Island, NY</div>
        </div>
      </div>
    </footer>
  );
}
