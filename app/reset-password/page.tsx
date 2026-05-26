import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

/**
 * /reset-password — landed-on after the user clicks the reset link in
 * their email and /auth/callback has exchanged the code for a session.
 * If the session is missing (link expired, manual visit), bounce to
 * /forgot-password so the user can request a new link.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/forgot-password?expired=1');
  }

  return (
    <section className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <h1 className="font-headline text-3xl sm:text-4xl font-bold text-zinc-900 text-center">
        Set a new password
      </h1>
      <p className="mt-3 text-sm text-zinc-500 text-center">
        Choose a password you don&apos;t use anywhere else.
      </p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </section>
  );
}
