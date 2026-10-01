import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

// The token_hash flow must read searchParams per request.
export const dynamic = 'force-dynamic';

/**
 * /reset-password — two ways in:
 *
 * 1. ?token_hash=... (the reset email links here directly since
 *    2026-10-01): render the form WITHOUT touching the token. It is only
 *    consumed when the form is submitted, so email-security scanners that
 *    prefetch the link (Microsoft Defender Safe Links burned every reset
 *    link sent to a corporate inbox) can't invalidate it.
 *
 * 2. A recovery session from /auth/callback (legacy emails sent before
 *    the template change). If neither is present (expired link, manual
 *    visit), bounce to /forgot-password so the user can request a new
 *    link.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token_hash?: string };
}) {
  const tokenHash = (searchParams.token_hash ?? '').trim() || null;

  if (!tokenHash) {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/forgot-password?expired=1');
    }
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
        <ResetPasswordForm tokenHash={tokenHash} />
      </div>
    </section>
  );
}
