import type { Metadata } from 'next';
import { requireMasterAdmin } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getHouseStyle } from '@/lib/house-style';
import { GuidelinesEditor } from './guidelines-editor';

export const metadata: Metadata = {
  title: 'Writing Guidelines · Master Admin Stories',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function WritingGuidelinesPage() {
  const user = await requireMasterAdmin('/portal/all/master-admin-stories/guidelines');
  const style = await getHouseStyle();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="House Writing Guidelines"
      backLink={{ href: '/portal/all/master-admin-stories', label: 'Master Admin Stories' }}
    >
      <div className="max-w-3xl">
        <p className="text-sm text-zinc-600">
          These guidelines are read by every AI writing path each time it runs — Howard Roark, Gail
          Wynand (local and national) and Henry Cameron on the office PC, and the AI-revise box in
          Master Admin Stories. They shape <em>how</em> the prose reads. Each writer&rsquo;s own
          voice instructions take precedence where they conflict, and the straight-news local desk
          applies only the ones compatible with facts-only reporting.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {style?.updated_at
            ? `Last saved ${new Date(style.updated_at).toLocaleString()}.`
            : 'Not saved yet — run migration 045 if the save fails.'}
        </p>
        <GuidelinesEditor initial={style?.content ?? ''} />
      </div>
    </PortalShell>
  );
}
