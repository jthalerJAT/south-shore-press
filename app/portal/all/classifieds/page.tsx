import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getClassifiedsList, classifiedPublicUrl, formatClassifiedDate } from '@/lib/queries/classifieds';
import { ClassifiedsAdmin } from './classifieds-admin';

export const metadata: Metadata = {
  title: 'Classified Upload',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PortalClassifiedsPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/classifieds'
  );

  const classifieds = await getClassifiedsList();
  const rows = classifieds.map((c) => ({
    id: c.id,
    iso: c.classified_date,
    dateLabel: formatClassifiedDate(c.classified_date),
    url: classifiedPublicUrl(c.storage_path),
    fileName: c.file_name,
  }));

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Classified Upload"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <ClassifiedsAdmin classifieds={rows} />
    </PortalShell>
  );
}
