import type { Metadata } from 'next';
import Link from 'next/link';
import { Users, LayoutGrid, FileEdit, FileText, Newspaper, Megaphone, Image as ImageIcon, Share2, ArrowRight } from 'lucide-react';
import { requireRole, canManageCredentials } from '@/lib/auth';
import { PortalShell } from '@/components/portal/portal-shell';

export const metadata: Metadata = {
  title: 'Editor Portal',
  robots: { index: false, follow: false },
};

/**
 * Editor Portal landing — three-card hub per v1 spec.
 *
 *   Credentials   → designate user roles (journalist / editor / admin)
 *   Site Layout   → assign stories to specific slots on the public site
 *   Edit Stories  → searchable + sortable table of every story
 *
 * Each sub-page renders its own back arrow pointing to this landing.
 */
export default async function EditorPortalLandingPage() {
  const user = await requireRole(
    ['editor', 'admin', 'master admin'],
    '/portal/all'
  );

  // Only admins manage credentials — editors see every other tile but not
  // this one.
  const showCredentials = canManageCredentials(user);

  const tiles: Array<{
    href: string;
    title: string;
    description: string;
    icon: typeof Users;
    badge?: string;
  }> = [
    ...(showCredentials
      ? [
          {
            href: '/portal/all/credentials',
            title: 'Credentials',
            description:
              'Promote or demote users between journalist, editor, and admin roles.',
            icon: Users,
          },
        ]
      : []),
    {
      href: '/portal/all/site-layout',
      title: 'Site Layout',
      description:
        'Pin stories to specific slots on the homepage and section pages.',
      icon: LayoutGrid,
      badge: 'Coming soon',
    },
    {
      href: '/portal/all/edit-stories',
      title: 'Edit Stories',
      description:
        'Search, sort, and edit every story in the system. Click a row to open the editor.',
      icon: FileEdit,
    },
    {
      href: '/portal/all/legals',
      title: 'Legals Upload',
      description:
        'Upload and manage the weekly legal-notice PDFs shown on the public Legals page.',
      icon: FileText,
    },
    {
      href: '/portal/all/newspaper-creator',
      title: 'Newspaper Creator',
      description:
        'Build the weekly print issue — drag stories onto pages, edit content, and lay out the paper.',
      icon: Newspaper,
    },
    {
      href: '/portal/all/ads',
      title: 'Ad Database',
      description:
        'Manage advertisers, ad copy, and scheduled print runs with invoiced / paid tracking.',
      icon: Megaphone,
    },
    {
      href: '/portal/all/owned-images',
      title: 'Owned Images',
      description:
        'Every proprietary photo uploaded through the editor, newest first — reuse or delete them.',
      icon: ImageIcon,
    },
    {
      href: '/portal/all/social',
      title: 'Social Media',
      description:
        'Compose and publish posts. Drag a story into a tweet and push it to the SSP X account.',
      icon: Share2,
    },
  ];

  return (
    <PortalShell
      user={user}
      activeTab="all"
      title="Editor Portal"
      backLink={{ href: '/', label: 'Homepage' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group block bg-white border border-zinc-200 hover:border-brand-red rounded-lg p-6 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 flex items-center justify-center bg-zinc-100 group-hover:bg-brand-red/10 text-zinc-700 group-hover:text-brand-red rounded transition-colors">
                <tile.icon className="w-5 h-5" />
              </div>
              {tile.badge ? (
                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                  {tile.badge}
                </span>
              ) : null}
            </div>
            <h2 className="mt-5 font-headline text-xl font-bold text-zinc-900 group-hover:text-brand-red transition-colors">
              {tile.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              {tile.description}
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-brand-red opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
