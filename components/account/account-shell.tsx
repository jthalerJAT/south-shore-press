import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/site/sign-out-button';

/**
 * Shared chrome for /account/* pages — header with the user's name,
 * tab nav (Profile / Payment / Subscription / Security), and a sign-out
 * link. Server component; takes the active tab + pre-fetched user data
 * as props.
 */
export type AccountTab = 'profile' | 'payment' | 'subscription' | 'security';

const TABS: Array<{ key: AccountTab; label: string; href: string }> = [
  { key: 'profile', label: 'Profile', href: '/account' },
  { key: 'payment', label: 'Payment', href: '/account/payment' },
  { key: 'subscription', label: 'Subscription', href: '/account/subscription' },
  { key: 'security', label: 'Security', href: '/account/security' },
];

export function AccountShell({
  user,
  activeTab,
  children,
}: {
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  activeTab: AccountTab;
  children: React.ReactNode;
}) {
  const greetingName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
            My Account
          </div>
          <h1 className="mt-1 font-headline text-3xl sm:text-4xl font-bold text-zinc-900">
            {greetingName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        </div>
        <SignOutButton className="px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors disabled:opacity-60" />
      </div>

      <nav
        aria-label="Account sections"
        className="mt-6 flex flex-wrap items-center gap-1 border-b border-zinc-200"
      >
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-brand-red text-brand-red'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
