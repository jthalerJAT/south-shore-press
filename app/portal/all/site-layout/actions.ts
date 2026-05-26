'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { canManageAllStories } from '@/lib/auth';

/**
 * Server Actions for editing the site_layout_pins table from the Site
 * Layout page. All gated to editor / admin / master admin via
 * canManageAllStories — the RLS policy enforces the same on the DB
 * side as a defense-in-depth backstop.
 *
 * After every mutation we revalidate '/' so the homepage picks up the
 * new layout immediately (and each section page if relevant).
 */

type Result = { error: string | null };

/** Pin a story to a slot position. Replaces any existing pin at that
 *  same (slot_key, position) via ON CONFLICT — the table has a unique
 *  constraint on those two columns, so upsert is one statement. */
export async function setPinAction(
  slotKey: string,
  position: number,
  storyId: string
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };
  if (!canManageAllStories(user.role)) {
    return { error: 'Insufficient permissions.' };
  }
  if (!slotKey || position < 1 || !storyId) {
    return { error: 'Invalid pin parameters.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('site_layout_pins')
    .upsert(
      {
        slot_key: slotKey,
        position,
        story_id: storyId,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slot_key,position' }
    );

  if (error) {
    console.error('[setPinAction]', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      slotKey,
      position,
      storyId,
    });
    return {
      error:
        [error.message, error.details, error.hint]
          .filter(Boolean)
          .join(' — ') || 'Failed to set pin.',
    };
  }

  invalidateCachesForSlot(slotKey);
  return { error: null };
}

/** Clear a single slot position. */
export async function clearPinAction(
  slotKey: string,
  position: number
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };
  if (!canManageAllStories(user.role)) {
    return { error: 'Insufficient permissions.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('site_layout_pins')
    .delete()
    .eq('slot_key', slotKey)
    .eq('position', position);

  if (error) {
    console.error('[clearPinAction]', error);
    return { error: error.message };
  }

  invalidateCachesForSlot(slotKey);
  return { error: null };
}

/** Revalidate the public pages affected by a change to this slot. */
function invalidateCachesForSlot(slotKey: string) {
  // The homepage consumes home.* slot keys; any home.* change invalidates it.
  if (slotKey.startsWith('home.')) {
    revalidatePath('/');
  }
  // section.<slug> changes invalidate that section's index page.
  // Supports both:
  //   section.sports             → /sports
  //   section.sports.recent      → /sports
  //   section.sports.local-sports → /sports
  // The leading slug after `section.` is the page that needs to refresh.
  if (slotKey.startsWith('section.')) {
    const path = slotKey.slice('section.'.length);
    const leadSlug = path.split('.')[0];
    revalidatePath(`/${leadSlug}`);
  }
  // The Site Layout page itself shows current pins.
  revalidatePath('/portal/all/site-layout');
}
