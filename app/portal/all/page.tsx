import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { StoriesTable } from '@/components/portal/stories-table';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';

export const metadata: Metadata = {
  title: 'All stories',
  robots: { index: false, follow: false },
};

export default async function PortalAllStoriesPage() {
  // Editors and admins only — journalists trying to deep-link here get
  // bounced to /portal?denied=1.
  const user = await requireRole(['editor', 'admin'], '/portal/all');
  const stories = await getAllStoriesForEditor();

  return (
    <PortalShell user={user} activeTab="all" title="All Stories">
      <StoriesTable
        stories={stories}
        showAuthor
        emptyMessage="No stories in the system yet."
      />
    </PortalShell>
  );
}
