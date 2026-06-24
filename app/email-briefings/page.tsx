import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getMyProfile } from '@/lib/queries/reader-profile';
import { maskPhoneInput } from '@/lib/phone';
import { BriefingForm, type BriefingDefaults } from './briefing-form';

export const metadata: Metadata = {
  title: 'Email Briefings',
  description:
    'Sign up for the daily South Shore Press email briefing — news from Long Island delivered to your inbox.',
};

// Reads the signed-in user on every request (drives the auth gate + autofill).
export const dynamic = 'force-dynamic';

const NEXT = '/email-briefings';

export default async function EmailBriefingsPage() {
  const user = await getCurrentUser();
  const profile = user ? await getMyProfile(user.id) : null;

  const defaults: BriefingDefaults = {
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    street: profile?.street_address ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    zip: profile?.zip_code ?? '',
    phone: profile?.phone ? maskPhoneInput(profile.phone) : '',
    email: profile?.email ?? user?.email ?? '',
  };

  return (
    <section className="max-w-2xl mx-auto px-6 py-16 sm:py-24 text-center">
      {/* ── Existing headline + explanation (unchanged) ───────── */}
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

      {/* ── New: auth gate + sign-up form ─────────────────────── */}
      {user ? (
        <BriefingForm defaults={defaults} />
      ) : (
        <div className="mt-10 rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-8">
          <h2 className="font-headline text-xl font-bold text-zinc-900">
            Sign in to subscribe
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Email briefings are tied to your South Shore Press account. Log in or
            create a free account to sign up.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/signin?next=${encodeURIComponent(NEXT)}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
            >
              Log In
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(NEXT)}`}
              className="inline-flex items-center justify-center px-6 py-3 border border-brand-red/40 text-brand-red hover:bg-red-50 text-sm font-semibold uppercase tracking-wide rounded transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
