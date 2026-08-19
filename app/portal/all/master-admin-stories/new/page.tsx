import type { Metadata } from 'next';
import { requireMasterAdmin } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { AdminStoryForm } from '../admin-story-form';

export const metadata: Metadata = {
  title: 'New · Master Admin Stories',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewAdminStoryPage() {
  const user = await requireMasterAdmin('/portal/all/master-admin-stories/new');
  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Master Admin Stories"
      backLink={{ href: '/portal/all/master-admin-stories', label: 'Master Admin Stories' }}
    >
      <AdminStoryForm story={null} defaultByline={user.displayName ?? ''} />
    </PortalShell>
  );
}
