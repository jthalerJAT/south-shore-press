import Link from 'next/link';
import Image from 'next/image';
import { SITE, SITE_SECTIONS } from '@/lib/site-config';

/**
 * v1-style footer. White-on-dark inversion from v1 doesn't apply
 * since v2's body is already light, so the footer stays white with
 * a thin top divider line for visual separation from content.
 *
 * Four-column layout at lg+:
 *   Brand + description | Sections | More | Company
 *
 * v1 splits the site sections into two footer groups:
 *   "Sections" = geographic news (Local, State, Nation, World)
 *   "More"     = special-interest (Sports, Crime, Opinion, Legals, Video Vault)
 *
 * Bottom bar: copyright on the left, social text-links on the right
 * (X / YouTube / Instagram — the handles already configured in
 * SITE.social; v1 used Facebook/X/Instagram, swap if you want).
 *
 * Mobile collapses to a 1-col stack at < sm, and a 2-col grid at sm,
 * with the brand spanning the full row.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  // v1 footer groupings, derived from the master section list.
  const sectionsCol = SITE_SECTIONS.filter((s) =>
    ['local', 'state', 'national', 'world'].includes(s.slug)
  );
  const moreCol = SITE_SECTIONS.filter((s) =>
    ['sports', 'crime', 'opinion', 'legals', 'video-vault'].includes(s.slug)
  );

  return (
    <footer className="mt-16 bg-white border-t border-zinc-200">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* BRAND COLUMN */}
          <div className="sm:col-span-2 lg:col-span-5">
            <Link href="/" className="inline-block group">
              <Image
                src="/logo.png"
                alt={SITE.name}
                width={400}
                height={80}
                className="h-14 w-auto group-hover:opacity-90 transition-opacity"
              />
            </Link>
            <p className="mt-4 text-[13px] leading-relaxed text-zinc-600 max-w-md">
              A Forward Truth Company. Bringing you the latest news, sports,
              and community stories from the South Shore and beyond.
            </p>
          </div>

          {/* SECTIONS */}
          <FooterColumn
            className="lg:col-span-2"
            title="Sections"
            links={sectionsCol.map((s) => ({
              href: `/${s.slug}`,
              label: s.label,
            }))}
          />

          {/* MORE */}
          <FooterColumn
            className="lg:col-span-2"
            title="More"
            links={moreCol.map((s) => ({
              href: `/${s.slug}`,
              label: s.label,
            }))}
          />

          {/* COMPANY */}
          <FooterColumn
            className="lg:col-span-3"
            title="Company"
            links={[
              { href: '/about', label: 'About Us' },
              { href: '/contact', label: 'Contact' },
              { href: '/advertise', label: 'Advertise' },
              { href: '/subscribe', label: 'Subscribe' },
              { href: '/privacy', label: 'Privacy Policy' },
              { href: '/terms', label: 'Terms of Service' },
            ]}
          />
        </div>

        {/* DIVIDER + BOTTOM BAR */}
        <div className="mt-10 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="text-zinc-500">
            &copy; {year} {SITE.publisher}. All rights reserved.
          </div>
          <nav
            aria-label="Social"
            className="flex items-center gap-5"
          >
            <a
              href={SITE.social.x}
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-widest font-semibold text-zinc-600 hover:text-brand-red transition-colors"
            >
              X
            </a>
            <a
              href={SITE.social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-widest font-semibold text-zinc-600 hover:text-brand-red transition-colors"
            >
              YouTube
            </a>
            <a
              href={SITE.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-widest font-semibold text-zinc-600 hover:text-brand-red transition-colors"
            >
              Instagram
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-[11px] uppercase tracking-[0.15em] font-bold text-zinc-900 mb-3">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[13px] text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
