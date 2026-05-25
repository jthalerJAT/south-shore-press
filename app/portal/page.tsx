import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { StoriesTable } from '@/components/portal/stories-table';
import { getStoriesAuthoredBy } from '@/lib/queries/editor-stories';

export const metadata: Metadata = {
  title: 'My stories',
  robots: { index: false, follow: false },
};

export default async function PortalMyStoriesPage({
  searchParams,
}: {
  searchParams: { denied?: string; deleted?: string };
}) {
  const user = await requireUser('/portal');
  const stories = await getStoriesAuthoredBy(user.id);

  return (
    <PortalShell user={user} activeTab="mine" title="My Stories">
      {searchParams.denied ? (
        <FlashBox tone="red">
          You don&apos;t have permission for that page.
        </FlashBox>
      ) : null}
      {searchParams.deleted ? (
        <FlashBox tone="green">Story deleted.</FlashBox>
      ) : null}

      <StoriesTable
        stories={stories}
        emptyMessage="No stories yet. Click + Start New Story to get going."
      />
    </PortalShell>
  );
}

function FlashBox({
  tone,
  children,
}: {
  tone: 'red' | 'green';
  children: React.ReactNode;
}) {
  const styles =
    tone === 'red'
      ? 'text-red-700 bg-red-50 border-red-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return (
    <div
      role={tone === 'red' ? 'alert' : 'status'}
      className={`mb-4 text-sm border rounded px-3 py-2 ${styles}`}
    >
      {children}
    </div>
  );
}
