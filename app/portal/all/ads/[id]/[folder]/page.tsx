import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole, canManageCredentials } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getAdClient, type AdFileKind } from '@/lib/queries/ad-clients';
import { FolderView } from './folder-view';

export const metadata: Metadata = {
  title: 'Files · Ad Database',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const FOLDER_KINDS: Record<string, { kind: AdFileKind; label: string }> = {
  copy: { kind: 'copy', label: 'Ad Copy' },
  'insert-orders': { kind: 'insert_order', label: 'Insert Orders' },
  contracts: { kind: 'contract', label: 'Contracts' },
};

export default async function AdClientFolderPage({
  params,
}: {
  params: { id: string; folder: string };
}) {
  const folder = FOLDER_KINDS[params.folder];
  if (!folder) notFound();

  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/ads/${params.id}/${params.folder}`
  );
  const result = await getAdClient(params.id);
  if (!result) notFound();
  const { client, files } = result;

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title={`${client.business_name} — ${folder.label}`}
      backLink={{ href: `/portal/all/ads/${client.id}`, label: client.business_name }}
      hideTabs
    >
      <FolderView
        clientId={client.id}
        kind={folder.kind}
        files={files.filter((f) => f.kind === folder.kind)}
        isAdmin={canManageCredentials(user)}
      />
    </PortalShell>
  );
}
