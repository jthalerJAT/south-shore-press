import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { SiteLayoutBoard } from '@/components/portal/site-layout-board';
import { getAllPins } from '@/lib/queries/site-layout';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';

export const metadata: Metadata = {
  title: 'Site Layout',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Site Layout. Drag stories from the left list onto
 * slots on the right to pin them to specific positions on the public
 * site. Unfilled slots fall back to recency-based defaults at render
 * time.
 *
 * Server component fetches:
 *   - All editor-visible stories (drafts + everything) so the left list
 *     covers anything an editor might want to surface
 *   - Current pin state for the whole site
 * Hands both to the client SiteLayoutBoard which renders the dnd-kit
 * drag/drop UI.
 */
export default async function SiteLayoutPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/site-layout'
  );

  // Fan-out the two queries.
  const [allStories, pins] = await Promise.all([
    getAllStoriesForEditor(),
    getAllPins(),
  ]);

  // Only published stories can sit in slots (we don't want a draft
  // accidentally showing on the homepage).
  const publishedStories = allStories.filter((s) => s.status === 'published');

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Site Layout"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <SiteLayoutBoard publishedStories={publishedStories} initialPins={pins} />
    </PortalShell>
  );
}
