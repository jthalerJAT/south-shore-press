import Link from 'next/link';

/**
 * PagePager — previous / next page links for the Newspaper Creator's editors,
 * so the publisher can flip through the whole deck without going back to the
 * board between pages (publisher direction 2026-10-13).
 *
 * Both ends are stubbed out rather than hidden, so the control doesn't jump
 * around as you move through the issue.
 */
export type PagerTarget = {
  id: string;
  /** Printed page number. */
  ordinal: number;
  title: string;
};

export function PagePager({
  prev,
  next,
  basePath = '/portal/all/newspaper-creator',
  /** Appended to the target URL, e.g. '/layout' to keep flipping through the
   *  layout editor rather than landing on page content. */
  suffix = '',
}: {
  prev: PagerTarget | null;
  next: PagerTarget | null;
  basePath?: string;
  suffix?: string;
}) {
  const cls =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded transition-colors';
  const live = 'text-zinc-700 border-zinc-300 hover:bg-zinc-50';
  const dead = 'text-zinc-300 border-zinc-200 cursor-default';

  return (
    <div className="flex items-center gap-2">
      {prev ? (
        <Link
          href={`${basePath}/${prev.id}${suffix}`}
          className={`${cls} ${live}`}
          title={`Page ${prev.ordinal} — ${prev.title}`}
        >
          ← Page {prev.ordinal}
        </Link>
      ) : (
        <span className={`${cls} ${dead}`}>← Page</span>
      )}
      {next ? (
        <Link
          href={`${basePath}/${next.id}${suffix}`}
          className={`${cls} ${live}`}
          title={`Page ${next.ordinal} — ${next.title}`}
        >
          Page {next.ordinal} →
        </Link>
      ) : (
        <span className={`${cls} ${dead}`}>Page →</span>
      )}
    </div>
  );
}
