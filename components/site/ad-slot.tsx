'use client';

/**
 * A single Google AdSense display unit (publisher direction 2026-11-08:
 * fixed placements, not Auto ads — the paper controls where ads appear).
 *
 * Slot IDs come from the environment so new units can be created in AdSense
 * without a code change. A slot with no ID renders NOTHING: no empty box, no
 * stray label, so the page looks finished before the units exist.
 *
 * The script that powers these is loaded only on public pages
 * (components/site/adsense-script.tsx) — never on the portals or the /print
 * routes the press PDF renders from.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isAdSurface } from './adsense-script';

const CLIENT = 'ca-pub-2614812694388385';

export type AdPlacement = 'in_article' | 'article_end' | 'section';

const SLOT_IDS: Record<AdPlacement, string | undefined> = {
  in_article: process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE,
  article_end: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END,
  section: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SECTION,
};

export function AdSlot({
  placement,
  className = '',
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const slot = SLOT_IDS[placement];
  const pathname = usePathname();
  const ref = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const live = Boolean(slot) && isAdSurface(pathname);

  useEffect(() => {
    if (!live || pushed.current) return;
    // The loader may still be in flight; adsbygoogle is a queue either way.
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({});
      pushed.current = true;
    } catch {
      /* an ad that fails to fill must never break the page */
    }
  }, [live]);

  if (!live) return null;

  return (
    <aside className={`my-8 text-center ${className}`} aria-label="Advertisement">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-400">
        Advertisement
      </div>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format={placement === 'in_article' ? 'fluid' : 'auto'}
        {...(placement === 'in_article' ? { 'data-ad-layout': 'in-article' } : {})}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
