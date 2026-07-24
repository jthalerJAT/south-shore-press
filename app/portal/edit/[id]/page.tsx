import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';
import { StoryForm } from '@/components/portal/story-form';
import { getStoryForEdit } from '@/lib/queries/editor-stories';
import { getStoryAudit } from '@/lib/queries/story-audit';
import { StatusBadge } from '@/components/portal/status-badge';
import { StoryHistory } from '@/components/portal/story-history';

export const metadata: Metadata = {
  title: 'Edit story',
  robots: { index: false, follow: false },
};

type Params = { id: string };

export default async function PortalEditStoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: { saved?: string };
}) {
  const user = await requireUser(`/portal/edit/${params.id}`);
  const [story, audit] = await Promise.all([
    getStoryForEdit(params.id),
    getStoryAudit(params.id),
  ]);
  if (!story) notFound();

  // Journalists can VIEW any story they authored, regardless of status —
  // but the form decides whether they can EDIT (read-only when their
  // own story is published/unpublished). Other journalists' stories:
  // we bounce them home rather than render a confusing read-only view.
  if (user.role === 'journalist' && story.author_id !== user.id) {
    notFound();
  }

  const canEdit =
    user.role === 'editor' ||
    user.role === 'admin' ||
    user.role === 'master admin' ||
    (user.role === 'journalist' && story.author_id === user.id);

  // Pick the most sensible back-link target based on role: editors
  // likely came from the Edit Stories table, journalists from their
  // own drafts list. (Smarter would be a ?from= referrer param, but
  // this default is right >90% of the time.)
  const backHref =
    user.role === 'journalist'
      ? { href: '/portal', label: 'Story Editor' }
      : { href: '/portal/all/edit-stories', label: 'Edit Stories' };

  return (
    <PortalShell
      user={user}
      activeTab="editing"
      title={story.headline || 'Untitled'}
      backLink={backHref}
    >
      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={story.status} />
        {story.author?.display_name ? (
          <span className="text-sm text-zinc-500">
            by {story.author.display_name}
          </span>
        ) : null}
      </div>

      <StoryForm
        mode="edit"
        role={user.role}
        canEdit={canEdit}
        flash={searchParams.saved ? 'Saved.' : null}
        defaults={{
          id: story.id,
          headline: story.headline,
          subline: story.subline,
          byline: story.byline,
          body: story.body,
          hero_photo_url: story.hero_photo_url,
          photo_caption: story.photo_caption,
          photo_credit: story.photo_credit,
          extra_photo_urls: story.extra_photo_urls,
          categories: story.categories,
          status: story.status,
          published_at: story.published_at,
        }}
      />

      <StoryHistory entries={audit} />
    </PortalShell>
  );
}
