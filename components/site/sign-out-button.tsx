'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signOutAction } from '@/app/signin/actions';

/**
 * Client wrapper around the signOutAction. Calls the action, then runs
 * router.push('/') + router.refresh() so the masthead AuthChip (a Client
 * Component whose /api/me fetch only fires on pathname change) re-runs
 * and reflects the signed-out state immediately.
 *
 * Without this wrapper, clicking Sign Out from the homepage signs the
 * user out cookie-wise but leaves "Hi, [Name]" + the Sign Out button
 * visible until a hard refresh, which looks like sign-out is broken.
 */
export function SignOutButton({
  className,
  children = 'Sign Out',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await signOutAction();
          } catch {
            // signOutAction calls redirect() which throws NEXT_REDIRECT.
            // That's expected — swallow it. The actual sign-out (cookie
            // wipe + revalidate) has already happened by the time the
            // throw bubbles up.
          }
          router.push('/');
          router.refresh();
        });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
