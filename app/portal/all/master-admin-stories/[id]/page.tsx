import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireMasterAdmin } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAdminStory } from '@/lib/queries/admin-stories';
import { AdminStoryForm } from '../admin-story-form';

export const metadata: Metadata = {
  title: 'Edit · Master Admin Stories',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditAdminStoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { saved?: string };
}) {
  const user = await requireMasterAdmin(`/portal/all/master-admin-stories/${params.id}`);
  const story = await getAdminStory(params.id);
  if (!story) notFound();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Master Admin Stories"
      backLink={{ href: '/portal/all/master-admin-stories', label: 'Master Admin Stories' }}
    >
      <AdminStoryForm
        story={story}
        flash={searchParams?.saved === '1' ? 'Saved to Admin Drafts.' : null}
      />
    </PortalShell>
  );
}
