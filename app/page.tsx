// Phase-0 skeleton page. Replaced in Phase 2 with the real Homepage
// (server-rendered hero carousel + section grids fed from Supabase).

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-white">
      <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl text-brand-red font-bold tracking-tight text-center">
        The South Shore Press
      </h1>
      <p className="mt-3 text-base sm:text-lg text-zinc-500 italic text-center">
        From Long Island to the World
      </p>

      <div className="mt-12 max-w-xl w-full bg-zinc-50 border border-zinc-200 rounded-lg p-6 sm:p-8">
        <div className="text-xs uppercase tracking-wider text-brand-red font-semibold mb-2">
          v2 — under construction
        </div>
        <p className="text-zinc-700 leading-relaxed">
          We&apos;re rebuilding the site on a modern, server-rendered,
          mobile-first stack so search engines, social previews, and ad
          platforms work the way a real news site needs them to.
        </p>
        <p className="text-zinc-600 leading-relaxed mt-4 text-sm">
          The current site stays live during the rebuild at{' '}
          <a
            href="https://southshorepress.vercel.app"
            className="text-brand-red hover:underline font-medium"
          >
            southshorepress.vercel.app
          </a>
          .
        </p>
      </div>

      <footer className="mt-16 text-xs text-zinc-400 text-center">
        Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Supabase
      </footer>
    </main>
  );
}
