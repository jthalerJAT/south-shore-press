import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
};

/**
 * Reader self-signup page. Editor/journalist accounts are still
 * provisioned manually in Supabase by an admin — this page is for
 * public readers who want an account so they can subscribe, get
 * briefings, etc.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(searchParams.next ?? '/account');
  }

  return (
    <section className="max-w-xl mx-auto px-6 py-12 sm:py-16">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900 text-center">
        Create your account
      </h1>
      <p className="mt-3 text-sm text-zinc-500 text-center">
        Free to sign up. Add a payment method later for paid subscriptions.
      </p>
      <div className="mt-8">
        <SignUpForm next={searchParams.next ?? '/account'} />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{' '}
        <Link href="/signin" className="text-brand-red hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </section>
  );
}
