import type { Metadata } from 'next';
import { ConfirmClient } from './confirm-client';

export const metadata: Metadata = {
  title: 'Confirm your account · The South Shore Press',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Scanner-proof email confirmation. The Supabase "Confirm signup" email links
 * here with a token_hash instead of Supabase's self-consuming verify URL.
 * Corporate mail scanners (Mimecast, Outlook SafeLinks, …) prefetch every link
 * in an email with a GET — which used to consume the one-time token before the
 * human could click it. This page renders a button, and only that explicit
 * click calls verifyOtp, so a prefetch can never burn the token.
 */
export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string };
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:py-24">
      <ConfirmClient
        tokenHash={searchParams.token_hash ?? ''}
        type={searchParams.type ?? 'signup'}
      />
    </div>
  );
}
