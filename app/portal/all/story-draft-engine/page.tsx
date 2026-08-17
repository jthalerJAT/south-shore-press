import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { getStoryCandidates } from '@/lib/queries/draft-engine';

export const metadata: Metadata = {
  title: 'Story Draft Engine',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function StoryDraftEnginePage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/story-draft-engine'
  );
  const candidates = await getStoryCandidates();

  return (
    <PortalShell
      user={user}
      activeTab="all"
      hideTabs
      title="Story Draft Engine"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <p className="text-sm text-zinc-600 mb-4">
        Dual-sourced story candidates from the news desks. Open one to choose the facts, add your
        angle, and generate an article — you are the author; the engine writes to your selections.
      </p>
      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="grid grid-cols-[7rem_1fr_8rem_7rem] items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          <div>Date</div>
          <div>Subject</div>
          <div>Section</div>
          <div>Status</div>
        </div>
        {candidates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">
            No candidates waiting — the news desks post new ones each cycle.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {candidates.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/all/story-draft-engine/${c.id}`}
                  className="grid grid-cols-[7rem_1fr_8rem_7rem] items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-sm text-zinc-500">{fmtDate(c.created_at)}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{c.headline}</div>
                    {c.summary ? (
                      <div className="text-xs text-zinc-500 truncate">{c.summary}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500 capitalize">{c.section ?? '—'}</div>
                  <div>
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded ${
                        c.status === 'generated'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : c.status === 'drafted'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}
                    >
                      {c.status === 'generated'
                        ? 'Article ready'
                        : c.status === 'drafted'
                        ? 'In Story Editor'
                        : 'New'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
