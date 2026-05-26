import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';

export const metadata: Metadata = {
  title: 'Site Layout',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal → Site Layout. Placeholder for the slot-assignment UI.
 *
 * Eventual implementation:
 *   - New DB columns or table: a per-slot pinned story id (e.g.
 *     hero_slot_1..5, top_stories_pins[10])
 *   - This page: drag-and-drop or dropdown picker per slot, with
 *     live preview of the resulting homepage layout
 *   - Homepage query (getLatestPublishedStories / getTopStories)
 *     would fall back to recency only when slots are empty
 */
export default async function SiteLayoutPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all/site-layout'
  );

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Site Layout"
      backLink={{ href: '/portal/all', label: 'Editor Portal' }}
    >
      <div className="max-w-2xl mx-auto py-10 text-center">
        <div className="inline-block bg-zinc-50 border border-zinc-200 rounded px-6 py-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
            Coming soon
          </div>
          <h2 className="mt-2 font-headline text-xl font-bold text-zinc-900">
            Story slot assignment
          </h2>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            This page will let editors pin specific stories to the hero
            carousel, Top Stories rail, and individual section blocks on
            the public homepage. Today those slots auto-populate from
            recency.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
