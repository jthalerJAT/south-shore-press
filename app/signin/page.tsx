import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, canManageAllStories } from '@/lib/auth';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

// Server component shell. If the user is already signed in, send them
// straight where they were trying to go (or to a role-appropriate
// default).
export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string; confirmed?: string; reset?: string; error?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    if (searchParams.next) {
      redirect(searchParams.next);
    }
    redirect(
      canManageAllStories(user.role) || user.role === 'journalist'
        ? '/portal'
        : '/account'
    );
  }

  // Explicit next is passed through the form as a hidden field. Empty
  // string = "no deep-link target, pick based on role after sign-in".
  const next = searchParams.next ?? '';

  return (
    <section className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900 text-center">
        Sign in
      </h1>

      {searchParams.confirmed ? (
        <div
          role="status"
          className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 text-center"
        >
          Your email is confirmed. Sign in to continue.
        </div>
      ) : null}
      {searchParams.reset ? (
        <div
          role="status"
          className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 text-center"
        >
          Password updated. Sign in with your new password.
        </div>
      ) : null}
      {searchParams.error ? (
        <div
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center"
        >
          That link is invalid or expired. Please try again.
        </div>
      ) : null}

      <div className="mt-8">
        <SignInForm next={next} />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm text-zinc-600 text-center">
        <Link href="/forgot-password" className="hover:text-brand-red hover:underline">
          Forgot password?
        </Link>
        <span>
          New to The South Shore Press?{' '}
          <Link href="/signup" className="text-brand-red hover:underline font-medium">
            Create account
          </Link>
        </span>
      </div>
    </section>
  );
}
