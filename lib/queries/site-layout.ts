import { createClient } from '@/lib/supabase/server';
import type { StoryListItem } from './stories';

/**
 * Site Layout pin data layer. Pins live in the `site_layout_pins` table
 * (see db/migrations/001_site_layout_pins.sql for the schema).
 *
 * The flow:
 *   1) Editor pins a story to a slot via the Site Layout page.
 *   2) The public-side page (homepage, section page) reads the pins for
 *      its slot key, plus a fallback list of recent stories, and uses
 *      resolveSlotStories() to compose the final ordered list.
 *   3) Slots without pins fall back to the recency-based default.
 *
 * Slot key convention (matches what the Site Layout UI writes):
 *   home.hero            5 slots — homepage hero carousel
 *   home.top_stories    10 slots — homepage Top Stories rail
 *   home.video_vault     4 slots — homepage Video Vault rail
 *   home.local           4 slots — homepage Local rail
 *   home.sports          4 slots — homepage Sports rail
 *   home.opinion         4 slots — homepage Opinion rail
 *   home.national        4 slots — homepage Nation rail
 *   section.<slug>       3 slots — top stories on each /<slug> page
 */

export type Pin = {
  slot_key: string;
  position: number;
  story_id: string;
};

/** Read all pins. Cheap — the table will only ever have ~60 rows total
 *  even when fully populated (all slot positions filled), and the
 *  homepage reads them once per ISR cycle. */
export async function getAllPins(): Promise<Pin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('site_layout_pins')
    .select('slot_key, position, story_id')
    .order('slot_key', { ascending: true })
    .order('position', { ascending: true });
  if (error) {
    console.error('[getAllPins]', error);
    return [];
  }
  return (data ?? []) as Pin[];
}

/** Read pins for a specific slot key (e.g. 'home.hero'). */
export async function getPinsForSlot(slotKey: string): Promise<Pin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('site_layout_pins')
    .select('slot_key, position, story_id')
    .eq('slot_key', slotKey)
    .order('position', { ascending: true });
  if (error) {
    console.error('[getPinsForSlot]', slotKey, error);
    return [];
  }
  return (data ?? []) as Pin[];
}

/**
 * Compose the final list of N stories for a slot:
 *   - For positions with a pin, use the pinned story (must be present
 *     in `fallback` — caller should fetch enough recent stories that
 *     pinned ones are included)
 *   - For positions without a pin, take the next non-pinned story from
 *     the fallback list in fallback order
 *   - Result is exactly N entries (or shorter if there aren't enough
 *     stories total)
 *
 * The pin's `position` is 1-indexed. Pins outside the range [1, count]
 * are ignored. If a pinned story isn't in the fallback list (e.g. an
 * older pinned story that fell off the recency cutoff), the slot's
 * pin is silently skipped and the slot uses fallback.
 */
export function resolveSlotStories<T extends { id: string }>(
  pins: Pin[],
  fallback: T[],
  count: number
): T[] {
  const fallbackById = new Map(fallback.map((s) => [s.id, s]));

  // Place pinned stories in their positions (only if the story is
  // available in the fallback set).
  const placed: (T | null)[] = new Array(count).fill(null);
  const usedIds = new Set<string>();

  for (const pin of pins) {
    const idx = pin.position - 1;
    if (idx < 0 || idx >= count) continue;
    const story = fallbackById.get(pin.story_id);
    if (story) {
      placed[idx] = story;
      usedIds.add(story.id);
    }
  }

  // Fill empty positions with the next non-used story from fallback
  // (preserves the fallback's ordering — typically reverse chronological).
  const queue = fallback.filter((s) => !usedIds.has(s.id));
  let qIdx = 0;
  for (let i = 0; i < count; i++) {
    if (placed[i] === null && qIdx < queue.length) {
      placed[i] = queue[qIdx++];
    }
  }

  return placed.filter((x): x is T => x !== null);
}

/** Convenience wrapper: fetch pins for a slot, then resolve. Useful
 *  when the caller already has the fallback list ready. */
export async function resolveSlot<T extends StoryListItem>(
  slotKey: string,
  fallback: T[],
  count: number
): Promise<T[]> {
  const pins = await getPinsForSlot(slotKey);
  return resolveSlotStories(pins, fallback, count);
}
