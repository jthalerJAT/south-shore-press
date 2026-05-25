import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { AllStoriesView } from '@/components/portal/all-stories-view';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';

export const metadata: Metadata = {
  title: 'All stories',
  robots: { index: false, follow: false },
};

// Server component: fetch the full story list, then hand off to the
// client AllStoriesView which handles search/sort/filter via URL params.
// Suspense boundary required because AllStoriesView uses
// useSearchParams (Next.js 14 will otherwise warn at build time).
export default async function PortalAllStoriesPage() {
  // Editors and admins only — journalists trying to deep-link here get
  // bounced to /portal?denied=1.
  const user = await requireRole(['editor', 'admin'], '/portal/all');
  const stories = await getAllStoriesForEditor();

  return (
    <PortalShell user={user} activeTab="all" title="All Stories">
      <Suspense fallback={null}>
        <AllStoriesView stories={stories} />
      </Suspense>
    </PortalShell>
  );
}
