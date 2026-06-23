'use client';

/**
 * Share controls shown beside the byline/date on a public article page:
 *   • X Post   — opens X's tweet composer with the article URL attached. X
 *                renders the article's Open Graph / summary_large_image card
 *                (hero photo + title), and the user types their own text above.
 *   • Email    — opens the reader's own mail client (mailto) with the headline
 *                + a link to the story. (mailto bodies are plain text, so the
 *                hero photo can't be embedded directly; most clients unfurl the
 *                link into a preview card.)
 *   • Copy Link — copies the canonical URL to the clipboard.
 */
import { useState } from 'react';

export function ArticleShare({
  url,
  title,
  byline,
}: {
  url: string;
  title: string;
  byline?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const xHref = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`;

  const emailBody = `${title}\n\n${byline ? `By ${byline}\n\n` : ''}Read the full story from The South Shore Press:\n${url}\n`;
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(emailBody)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (e.g. insecure context) — no-op.
    }
  }

  const cls =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-300 text-[12px] font-semibold text-zinc-700 hover:border-brand-red hover:text-brand-red transition-colors';

  return (
    <div className="flex items-center gap-2">
      <a href={xHref} target="_blank" rel="noopener noreferrer" className={cls} aria-label="Post this article on X">
        <span aria-hidden className="font-bold">𝕏</span> Post
      </a>
      <a href={emailHref} className={cls} aria-label="Email this article">
        Email
      </a>
      <button type="button" onClick={copyLink} className={cls} aria-label="Copy a link to this article">
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}
