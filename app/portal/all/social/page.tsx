import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAllStoriesForEditor } from '@/lib/queries/editor-stories';
import { isTwitterEnabled } from '@/lib/twitter/client';
import { SocialBoard } from './social-board';

export const metadata: Metadata = {
  title: 'Social Media · Editor Portal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SocialMediaPage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/social');
  const stories = await getAllStoriesForEditor();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Social Media"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <SocialBoard stories={stories} twitterEnabled={isTwitterEnabled()} />
    </PortalShell>
  );
}
