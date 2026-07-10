'use client';

import { useEffect } from 'react';

/**
 * Fire-and-forget story-view beacon. Renders nothing; on mount it reports one
 * view for this story to /api/track/view (powers the trending fallback in
 * "You Might Also Be Interested In"). sendBeacon survives quick navigations;
 * fetch is the fallback. Never throws into the page.
 */
export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    try {
      const payload = JSON.stringify({ id });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/track/view', payload))) {
        fetch('/api/track/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* never disturb the reader */
    }
  }, [id]);
  return null;
}
