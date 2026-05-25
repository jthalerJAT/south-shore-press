import Link from 'next/link';
import { StatusBadge } from './status-badge';
import type { EditorStoryRow } from '@/lib/queries/editor-stories';

/**
 * Table of stories used by /portal (journalist's own) and /portal/all
 * (editor's everything). Clicking a row opens the edit form. We render
 * a real semantic <table> so editors can reflow it on wide screens; on
 * mobile each row stacks via a card pattern.
 */

type Props = {
  stories: EditorStoryRow[];
  /** Show the Author column. False for "My Stories" since it'd be redundant. */
  showAuthor?: boolean;
  /** Message when the list is empty. */
  emptyMessage: string;
};

export function StoriesTable({ stories, showAuthor = false, emptyMessage }: Props) {
  if (stories.length === 0) {
    return (
      <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-zinc-200 rounded-lg">
      {/* Desktop table */}
      <table className="hidden sm:table w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="text-left font-semibold text-zinc-700 px-4 py-2.5">
              Headline
            </th>
            <th className="text-left font-semibold text-zinc-700 px-4 py-2.5 w-32">
              Section
            </th>
            <th className="text-left font-semibold text-zinc-700 px-4 py-2.5 w-32">
              Status
            </th>
            {showAuthor ? (
              <th className="text-left font-semibold text-zinc-700 px-4 py-2.5 w-40">
                Author
              </th>
            ) : null}
            <th className="text-left font-semibold text-zinc-700 px-4 py-2.5 w-32">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {stories.map((s) => (
            <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/portal/edit/${s.id}`}
                  className="font-medium text-zinc-900 hover:text-brand-red"
                >
                  {s.headline || <span className="italic text-zinc-400">(untitled)</span>}
                </Link>
                {s.subline ? (
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                    {s.subline}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {s.categories?.[0] ?? '—'}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} />
              </td>
              {showAuthor ? (
                <td className="px-4 py-3 text-zinc-600">
                  {s.author?.display_name ?? '—'}
                </td>
              ) : null}
              <td className="px-4 py-3 text-zinc-500 text-xs">
                {formatDate(s.published_at ?? s.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile stack */}
      <ul className="sm:hidden divide-y divide-zinc-100">
        {stories.map((s) => (
          <li key={s.id}>
            <Link
              href={`/portal/edit/${s.id}`}
              className="block px-4 py-3 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-zinc-900 line-clamp-2">
                  {s.headline || <span className="italic text-zinc-400">(untitled)</span>}
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-1 text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                <span>{s.categories?.[0] ?? '—'}</span>
                <span aria-hidden="true">·</span>
                {showAuthor && s.author?.display_name ? (
                  <>
                    <span>{s.author.display_name}</span>
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <time>{formatDate(s.published_at ?? s.created_at)}</time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
