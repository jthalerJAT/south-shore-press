import Link from 'next/link';
import type { UserRole } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { BackLink, type BackLinkSpec } from './back-link';
import { SignOutButton } from '@/components/site/sign-out-button';

/**
 * Top chrome for /portal/* pages. Shows:
 *   - Optional "← Back to X" link (one level up the portal hierarchy)
 *   - Page title + current user pill + Sign Out
 *   - Tabs: Story Editor | Editor Portal (editor+) | + Start New Story
 *
 * The active tab is passed in by each page (we can't sniff pathname from
 * a server component without next/headers gymnastics, and this is simpler).
 */
type Tab = 'mine' | 'all' | 'new' | 'editing';

const TABS: Array<{
  key: Tab;
  label: string;
  href: string;
  // Roles allowed to see this tab.
  roles: ReadonlyArray<UserRole>;
}> = [
  {
    key: 'mine',
    label: 'Story Editor',
    href: '/portal',
    roles: ['journalist', 'editor', 'admin', 'master admin'],
  },
  {
    key: 'all',
    label: 'Editor Portal',
    href: '/portal/all',
    roles: ['editor', 'admin', 'master admin'],
  },
];

export function PortalShell({
  user,
  activeTab,
  children,
  title,
  backLink,
}: {
  user: {
    email: string;
    displayName: string | null;
    role: UserRole;
  };
  activeTab: Tab;
  children: React.ReactNode;
  title?: string;
  /** Optional back-link rendered at the very top of the shell. Provide
   *  for any sub-page (e.g. /portal/all/edit-stories points back to
   *  /portal/all). Omit on root portal pages if you don't want a back
   *  arrow there. */
  backLink?: BackLinkSpec;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {backLink ? (
        <div className="mb-4">
          <BackLink {...backLink} />
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-red font-semibold">
            Newsroom
          </div>
          <h1 className="mt-1 font-headline text-2xl sm:text-3xl font-bold text-zinc-900">
            {title ?? 'Portal'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-900">
              {user.displayName ?? user.email}
            </div>
            <div className="text-xs text-zinc-500">
              <span className="inline-block px-1.5 py-0.5 bg-brand-red text-white text-[10px] uppercase tracking-widest font-semibold rounded mr-1.5">
                {user.role}
              </span>
              {user.email}
            </div>
          </div>
          <SignOutButton className="px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 rounded transition-colors disabled:opacity-60">
            Sign out
          </SignOutButton>
        </div>
      </div>

      <nav
        aria-label="Portal sections"
        className="mt-6 flex flex-wrap items-center gap-1 border-b border-zinc-200"
      >
        {TABS.filter((tab) => tab.roles.includes(user.role)).map((tab) => (
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
        <div className="ml-auto">
          <Link
            href="/portal/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 mb-1 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded transition-colors"
          >
            <span aria-hidden="true">+</span> Start New Story
          </Link>
        </div>
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
