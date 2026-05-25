'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side clock for the masthead. v1 displays:
 *     4:46 PM EST · Monday, May 25, 2026
 *
 * Why client-side: every public page (homepage, sections, stories) is
 * ISR-cached for ~60s. If we server-rendered the clock it would freeze
 * at whatever time the page was last generated. Computing in the browser
 * keeps it accurate on every visit.
 *
 * Renders an invisible placeholder during SSR + first paint so hydration
 * doesn't mismatch on the timezone abbreviation (server has no
 * America/New_York DST awareness without the Intl data, etc).
 */
export function HeaderClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Reserve vertical space so the layout doesn't jump on hydration.
    return (
      <div
        className={className}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
      >
        00:00 PM EST · Monday, January 1, 2026
      </div>
    );
  }

  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });

  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });

  return (
    <div className={className} suppressHydrationWarning>
      {time} · {date}
    </div>
  );
}
