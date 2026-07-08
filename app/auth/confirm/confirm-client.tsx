'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EmailOtpType } from '@supabase/supabase-js';

const VALID_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'email_change'];

/**
 * The human-click step of email confirmation. verifyOtp both confirms the
 * email AND signs the user in, so on success we send them to the homepage
 * already authenticated.
 */
export function ConfirmClient({ tokenHash, type }: { tokenHash: string; type: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const otpType: EmailOtpType = (VALID_TYPES as string[]).includes(type)
    ? (type as EmailOtpType)
    : 'signup';

  async function confirm() {
    setState('verifying');
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (err) {
      console.error('[auth/confirm]', err);
      setError(
        err.message.toLowerCase().includes('expired')
          ? 'This confirmation link has expired. Please sign up again or request a new link.'
          : 'This confirmation link is invalid or has already been used.'
      );
      setState('error');
      return;
    }
    setState('done');
    // Signed in by verifyOtp — take them home after a beat.
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 1500);
  }

  if (!tokenHash) {
    return (
      <Panel tone="error" title="Missing confirmation code">
        <p>
          This link is incomplete. Please open the confirmation email again and click its button —
          or <Link href="/signup" className="font-medium text-brand-red hover:underline">sign up</Link>{' '}
          to receive a new one.
        </p>
      </Panel>
    );
  }

  if (state === 'done') {
    return (
      <Panel tone="success" title="Your account is confirmed">
        <p>Welcome to The South Shore Press — taking you to the homepage…</p>
      </Panel>
    );
  }

  if (state === 'error') {
    return (
      <Panel tone="error" title="Could not confirm your account">
        <p>{error}</p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center rounded bg-brand-red px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white hover:bg-brand-red-dark"
          >
            Sign up again
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center rounded border border-zinc-300 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50"
          >
            Sign in
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel tone="neutral" title="Confirm your account">
      <p>
        Click the button below to finish creating your South Shore Press account. This confirms
        your email address and signs you in.
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={state === 'verifying'}
        className="mt-5 inline-flex items-center rounded bg-brand-red px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-brand-red-dark disabled:opacity-60 transition-colors"
      >
        {state === 'verifying' ? 'Confirming…' : 'Confirm my account'}
      </button>
    </Panel>
  );
}

function Panel({
  tone,
  title,
  children,
}: {
  tone: 'neutral' | 'success' | 'error';
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'error'
        ? 'border-red-200 bg-red-50'
        : 'border-zinc-200 bg-white';
  return (
    <div className={`rounded-lg border px-6 py-8 text-center shadow-sm ${toneClass}`}>
      <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
        The South Shore Press
      </div>
      <h1 className="mt-2 font-headline text-2xl font-bold text-zinc-900">{title}</h1>
      <div className="mt-3 text-sm leading-relaxed text-zinc-600">{children}</div>
    </div>
  );
}
