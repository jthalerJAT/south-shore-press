import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPage } from '@/lib/queries/newspaper';
import { getAds } from '@/lib/queries/ads';
import { templateId } from '@/lib/newspaper-templates';
import { normalizeFullAd } from '@/lib/newspaper/full-ad';
import { AdPicker } from './ad-picker-client';

export const metadata: Metadata = {
  title: 'Choose Ad · Newspaper Creator',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdPickerPage({ params }: { params: { pageId: string } }) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/newspaper-creator/${params.pageId}/ad-picker`
  );

  const page = await getPage(params.pageId);
  if (!page || templateId(page.kind) !== 'full_ad') notFound();

  const ads = await getAds();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Choose an Ad"
      backLink={{
        href: `/portal/all/newspaper-creator/${params.pageId}`,
        label: 'Back to page',
      }}
    >
      <AdPicker
        pageId={params.pageId}
        ads={ads.map((a) => ({
          id: a.id,
          business_name: a.business_name,
          copy_file_name: a.copy_file_name,
          copy_storage_path: a.copy_storage_path,
        }))}
        initialData={normalizeFullAd(page.template_data)}
      />
    </PortalShell>
  );
}
