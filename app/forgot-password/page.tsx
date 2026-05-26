import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <section className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900 text-center">
        Forgot password
      </h1>
      <p className="mt-3 text-sm text-zinc-500 text-center">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Remembered it?{' '}
        <Link href="/signin" className="text-brand-red hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </section>
  );
}
