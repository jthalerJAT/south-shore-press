import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { signOutAction } from '@/app/signin/actions';

export const metadata: Metadata = {
  title: 'Newsroom portal',
  robots: { index: false, follow: false },
};

// Phase 5 commit 1 stub. Confirms the auth round-trip works end-to-end.
// Subsequent commits replace this with the journalist drafts list
// + editor all-stories table.

export default async function PortalPage({
  searchParams,
}: {
  searchParams: { denied?: string };
}) {
  const user = await requireUser('/portal');

  return (
    <section className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
      <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
        Newsroom
      </div>
      <h1 className="mt-2 font-headline text-3xl sm:text-4xl font-bold text-zinc-900">
        Portal
      </h1>

      {searchParams.denied ? (
        <div
          role="alert"
          className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          You don&apos;t have permission for that page.
        </div>
      ) : null}

      <div className="mt-8 p-6 bg-zinc-50 border border-zinc-200 rounded">
        <div className="text-sm text-zinc-500">Signed in as</div>
        <div className="mt-1 text-base text-zinc-900 font-medium">
          {user.displayName ?? user.email}
        </div>
        <div className="mt-0.5 text-sm text-zinc-500">{user.email}</div>
        <div className="mt-2 inline-block text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 bg-brand-red text-white rounded">
          {user.role}
        </div>

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-white rounded transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="mt-8 text-sm text-zinc-500">
        The full editor portal is shipping in the next commit. This stub
        confirms the auth round-trip works.
      </p>
    </section>
  );
}
