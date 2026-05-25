import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

// Server component shell. If the user is already signed in, send them
// straight where they were trying to go (or to /portal as default).
export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const user = await getCurrentUser();
  const next = searchParams.next ?? '/portal';
  if (user) {
    redirect(next);
  }

  return (
    <section className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900 text-center">
        Sign in
      </h1>
      <p className="mt-3 text-sm text-zinc-500 text-center">
        Editor and journalist accounts only. Reader accounts coming later.
      </p>
      <div className="mt-8">
        <SignInForm next={next} />
      </div>
    </section>
  );
}
