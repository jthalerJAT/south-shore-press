import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { StoryForm } from '@/components/portal/story-form';

export const metadata: Metadata = {
  title: 'New story',
  robots: { index: false, follow: false },
};

export default async function PortalNewStoryPage() {
  const user = await requireUser('/portal/new');

  return (
    <PortalShell user={user} activeTab="new" title="New Story">
      <StoryForm
        mode="create"
        role={user.role}
        canEdit={true}
        defaults={{
          // Pre-fill the byline with the user's display name as a convenience;
          // they can change it before saving.
          byline: user.displayName ?? null,
        }}
      />
    </PortalShell>
  );
}
