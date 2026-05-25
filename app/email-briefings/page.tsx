import type { Metadata } from 'next';

// Placeholder. Future: form capturing name, address, email; subscribes
// the reader to the daily SSP email blast (likely SendGrid/Mailgun or
// a Postgres queue + cron). For now this resolves the header link so
// it doesn't 404.

export const metadata: Metadata = {
  title: 'Email Briefings',
  description:
    'Sign up for the daily South Shore Press email briefing — news from Long Island delivered to your inbox.',
};

export default function EmailBriefingsPage() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 sm:py-24 text-center">
      <div className="text-xs uppercase tracking-widest text-brand-red font-bold">
        Email Briefings
      </div>
      <h1 className="mt-3 font-headline text-3xl sm:text-4xl font-extrabold text-zinc-900">
        Daily news in your inbox.
      </h1>
      <p className="mt-6 text-lg text-zinc-600 leading-relaxed">
        Every morning we send the day&apos;s top South Shore stories
        straight to your inbox — local government, schools, sports, opinion,
        and the human-interest stuff you won&apos;t find anywhere else.
      </p>

      <div className="mt-10 inline-block bg-zinc-50 border border-zinc-200 rounded px-6 py-4">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
          Sign-up form coming soon
        </div>
        <div className="mt-1 text-sm text-zinc-700">
          We&apos;re wiring up the subscriber form. Check back shortly.
        </div>
      </div>
    </section>
  );
}
