import Link from 'next/link';
import type { Metadata } from 'next';

// Catches:
//   - Unknown sections (any URL that's not in SITE_SECTIONS)
//   - Unknown stories (short-id doesn't match any published story)
//   - Section-in-URL doesn't match the story's categories array
//   - Bare typos in any URL
// Wrapped by the root layout, so the header + footer chrome render around it.

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="max-w-xl mx-auto px-6 py-20 sm:py-28 text-center">
      <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
        404
      </div>
      <h1 className="mt-3 font-headline text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
        Story not found
      </h1>
      <p className="mt-6 text-zinc-600 leading-relaxed">
        The page you were looking for has moved, been unpublished, or was
        never here in the first place.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium uppercase tracking-wide rounded transition-colors"
      >
        Go to the homepage
      </Link>
    </section>
  );
}
