import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getOwnedImages, imagePublicUrl } from '@/lib/queries/owned-images';
import { OwnedImagesList } from './owned-images-list';

export const metadata: Metadata = {
  title: 'Owned Images · Editor Portal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnedImagesPage() {
  const user = await requireRole(['editor', 'admin', 'master admin'], '/portal/all/owned-images');
  const images = await getOwnedImages();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Owned Images"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <p className="text-sm text-zinc-600 mb-6 max-w-2xl">
        Every proprietary photo uploaded through a “+ Upload Photo” button, newest first. Copy a
        URL to reuse an image in another story, or delete one you no longer need.
      </p>
      <OwnedImagesList
        images={images.map((im) => ({
          id: im.id,
          url: imagePublicUrl(im.storage_path),
          fileName: im.file_name,
          createdAt: im.created_at,
        }))}
      />
    </PortalShell>
  );
}
