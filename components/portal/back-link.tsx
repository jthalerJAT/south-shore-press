import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export type BackLinkSpec = {
  href: string;
  /** e.g. "Editor Portal" — rendered as "← Back to Editor Portal" */
  label: string;
};

/**
 * Small "← Back to X" arrow rendered at the top of every portal
 * sub-page so users can climb up the hierarchy without relying on
 * the browser back button (which gets unreliable after form
 * submissions / redirects).
 *
 * Hardcoded parent paths beat using router.back() because:
 *   - router.back() doesn't know if you came from outside the portal
 *   - after a publish/save redirect, browser history points at the
 *     edit page itself, not the previous logical screen
 */
export function BackLink({ href, label }: BackLinkSpec) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-brand-red transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back to {label}
    </Link>
  );
}
