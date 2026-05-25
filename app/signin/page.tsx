import type { Metadata } from 'next';

// Placeholder so the header Sign-in link resolves cleanly. The real
// auth flow lands in Phase 5 when we port the editor/journalist portal.
// Until then this page just explains the state.

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <section className="max-w-md mx-auto px-6 py-16 sm:py-24 text-center">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900">
        Sign in
      </h1>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Reader accounts and the editor portal are coming in a later phase
        of the v2 rebuild. Check back soon.
      </p>
      <div className="mt-8 inline-block px-4 py-2 text-xs uppercase tracking-widest text-zinc-500 bg-zinc-100 rounded">
        Coming in Phase 5
      </div>
    </section>
  );
}
