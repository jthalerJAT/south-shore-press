// Phase-0 splash. Replaced in Phase 2 with the real Homepage
// (server-rendered hero carousel + section grids fed from Supabase).
// Header + footer now come from app/layout.tsx, so this page is just
// the centerpiece content.

export default function ComingSoonPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
      <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
        v2 — under construction
      </div>
      <h1 className="mt-3 font-headline text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
        We&apos;re rebuilding for speed, search, and scale.
      </h1>
      <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed">
        A modern, server-rendered, mobile-first stack so search engines,
        social previews, and ad platforms work the way a real news site needs
        them to.
      </p>
      <p className="mt-6 text-sm text-zinc-500">
        The current site stays live during the rebuild at{' '}
        <a
          href="https://southshorepress.vercel.app"
          className="text-brand-red hover:underline font-medium"
        >
          southshorepress.vercel.app
        </a>
        .
      </p>

      <div className="mt-12 text-xs text-zinc-400">
        Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Supabase
      </div>
    </section>
  );
}
