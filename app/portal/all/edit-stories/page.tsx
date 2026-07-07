import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { AllStoriesView } from '@/components/portal/all-stories-view';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';

export const metadata: Metadata = {
  title: 'Edit Stories',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Edit Stories sub-page. Searchable + sortable table
 * of every story in the system. Click a row to open the editor.
 *
 * Back arrow returns to the Editor Portal landing (/portal/all).
 */
export default async function PortalEditStoriesPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/edit-stories'
  );
  const stories = await getAllStoriesForEditor();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Edit Stories"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <Suspense fallback={null}>
        <AllStoriesView stories={stories} />
      </Suspense>
    </PortalShell>
  );
}
