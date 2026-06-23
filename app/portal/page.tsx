import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireUser, canManageAllStories } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { AllStoriesView } from '@/components/portal/all-stories-view';
import { getAllStoriesForEditor, getStoriesAuthoredBy } from '@/lib/queries/editor-stories';

export const metadata: Metadata = {
  title: 'My stories',
  robots: { index: false, follow: false },
};

/**
 * /portal "Story Editor" — drafts-only view per the v1 spec. Both
 * journalists and editors see their own work-in-progress drafts here.
 * Once a story leaves draft (submitted → published), it disappears
 * from this list; editors can find anything via /portal/all.
 *
 * The "+ Start New Story" button lives in PortalShell's nav strip.
 */
export default async function PortalMyDraftsPage({
  searchParams,
}: {
  searchParams: { denied?: string; deleted?: string };
}) {
  const user = await requireUser('/portal');
  // Editors/admins manage every story; a journalist sees only their own
  // (all statuses). Same table either way — just a different row set.
  const isEditor = canManageAllStories(user.role);
  const stories = isEditor
    ? await getAllStoriesForEditor()
    : await getStoriesAuthoredBy(user.id);

  return (
    <PortalShell
      user={user}
      activeTab="mine"
      title="Story Editor"
      backLink={{ href: '/', label: 'Homepage' }}
    >
      {searchParams.denied ? (
        <FlashBox tone="red">
          You don&apos;t have permission for that page.
        </FlashBox>
      ) : null}
      {searchParams.deleted ? (
        <FlashBox tone="green">Story deleted.</FlashBox>
      ) : null}

      <Suspense fallback={null}>
        <AllStoriesView
          stories={stories}
          emptyMessage={
            isEditor
              ? 'No stories yet.'
              : 'No stories yet. Click + Start New Story to write one.'
          }
        />
      </Suspense>
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
