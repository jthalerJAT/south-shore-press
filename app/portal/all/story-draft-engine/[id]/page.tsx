import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getStoryCandidate, getWriters } from '@/lib/queries/draft-engine';
import { CandidateWorkbench } from './candidate-workbench';

export const metadata: Metadata = {
  title: 'Candidate · Story Draft Engine',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    `/portal/all/story-draft-engine/${params.id}`
  );
  const [result, writers] = await Promise.all([getStoryCandidate(params.id), getWriters()]);
  if (!result || result.candidate.status === 'deleted' || result.candidate.status === 'drafted') {
    notFound();
  }

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title={result.candidate.headline}
      backLink={{ href: '/portal/all/story-draft-engine', label: 'Story Draft Engine' }}
    >
      <CandidateWorkbench
        candidate={result.candidate}
        facts={result.facts}
        writers={writers.map((w) => ({ name: w.name, desk: w.desk }))}
      />
    </PortalShell>
  );
}
