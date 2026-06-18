import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAd, adFilePublicUrl } from '@/lib/queries/ads';
import { AdForm } from '../ad-form';
import { AdRuns } from '../ad-runs';

export const metadata: Metadata = {
  title: 'Ad · Ad Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRole(['editor', 'admin', 'master admin'], `/portal/all/ads/${params.id}`);
  const result = await getAd(params.id);
  if (!result) notFound();
  const { ad, runs } = result;

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title={ad.business_name}
      backLink={{ href: '/portal/all/ads', label: 'Ad Database' }}
    >
      <AdForm mode="edit" ad={ad} />

      <div className="mt-10 border-t border-zinc-200 pt-6">
        <AdRuns
          adId={ad.id}
          runs={runs}
          adCopyUrl={ad.copy_storage_path ? adFilePublicUrl(ad.copy_storage_path) : null}
          adCopyName={ad.copy_file_name}
        />
      </div>
    </PortalShell>
  );
}
