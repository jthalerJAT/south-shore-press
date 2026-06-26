'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, type UserRole } from '@/lib/auth';
import { SITE_SECTIONS, SPORTS_SUBCATEGORIES, PRINT_ONLY_SLUG } from '@/lib/site-config';

/**
 * Server Actions for the newsroom portal. Every mutation flows through
 * here — no client-side Supabase writes. Auth + role gating enforced
 * per-action; pages also gate via requireUser / requireRole.
 *
 * Status transitions mirror v1:
 *   draft       → submitted   (journalist on own story)
 *   draft       → published   (editor/admin)
 *   submitted   → published   (editor/admin)
 *   published   → unpublished (editor/admin)
 *   unpublished → published   (editor/admin)
 *   any         → draft       (editor/admin downgrade)
 */

// All valid category slugs: header-nav sections + the sports sub-cats
// (the latter aren't standalone pages but are still legal tags).
const VALID_SECTIONS = new Set([
  ...SITE_SECTIONS.map((s) => s.slug),
  ...SPORTS_SUBCATEGORIES.map((s) => s.slug),
  PRINT_ONLY_SLUG, // saved + editor-visible, but excluded from the public site
]);

const SPORTS_SUBCATEGORY_SLUGS = new Set(SPORTS_SUBCATEGORIES.map((s) => s.slug));

// Only category slugs that correspond to actual page routes get a
// revalidatePath() call. Sub-cats like 'pro-sports' are tags only —
// they don't have their own /pro-sports page, so revalidatePath would
// either no-op (fine) or in some edge cases blow up the server action
// and leave the client's useFormState in an undefined state.
const ROUTE_SECTION_SLUGS = new Set(SITE_SECTIONS.map((s) => s.slug));

type FormResult = { error: string | null; id?: string };

/** Strip + validate the form payload that's common to create and update. */
function parseStoryFormData(formData: FormData) {
  const headline = String(formData.get('headline') ?? '').trim();
  const subline = String(formData.get('subline') ?? '').trim();
  const byline = String(formData.get('byline') ?? '').trim();
  const body = String(formData.get('body') ?? '');
  const hero_photo_url = String(formData.get('hero_photo_url') ?? '').trim();
  const photo_caption = String(formData.get('photo_caption') ?? '').trim();
  const photo_credit = String(formData.get('photo_credit') ?? '').trim();

  // extra_photo_urls comes in as N inputs all named "extra_photo_url"
  // (one per dynamic row in the editor). FormData.getAll() returns
  // each value; we trim + drop empties. Always returns an array (never
  // null) because the DB column is NOT NULL.
  const extra_photo_urls = formData
    .getAll('extra_photo_url')
    .map((v) => String(v).trim())
    .filter(Boolean);

  // Categories are a set of checkboxes; FormData.getAll('categories')
  // returns every checked one. Always an array — DB column is NOT NULL.
  // If any sports sub-category is checked, auto-add 'sports' so the
  // story shows in the parent Sports rail + page (single source of
  // truth: editor picks the most specific tag, system maintains the
  // hierarchy).
  const rawCategories = formData
    .getAll('categories')
    .map((v) => String(v))
    .filter((slug) => VALID_SECTIONS.has(slug));

  const hasSportsSubcat = rawCategories.some((c) =>
    SPORTS_SUBCATEGORY_SLUGS.has(c)
  );
  const categories =
    hasSportsSubcat && !rawCategories.includes('sports')
      ? [...rawCategories, 'sports']
      : rawCategories;

  return {
    headline,
    subline: subline || null,
    byline: byline || null,
    body: body || null,
    hero_photo_url: hero_photo_url || null,
    photo_caption: photo_caption || null,
    photo_credit: photo_credit || null,
    // Arrays kept as arrays (empty if user provided nothing) so we don't
    // trip Postgres NOT NULL constraints on these columns.
    extra_photo_urls,
    categories,
  };
}

/** Map the form's `intent` hidden field to the resulting story status. */
function resolveNextStatus(
  currentStatus: 'draft' | 'submitted' | 'published' | 'unpublished' | null,
  intent: string,
  role: UserRole
): {
  status: 'draft' | 'submitted' | 'published' | 'unpublished';
  setPublishedAt: 'now' | 'preserve';
} {
  switch (intent) {
    case 'save':
      // Save preserves current status (or defaults to draft for new).
      return {
        status: currentStatus ?? 'draft',
        setPublishedAt: 'preserve',
      };
    case 'submit':
      // Journalist-only intent.
      if (role !== 'journalist') {
        return { status: currentStatus ?? 'draft', setPublishedAt: 'preserve' };
      }
      return { status: 'submitted', setPublishedAt: 'preserve' };
    case 'publish':
      return {
        status: 'published',
        // Set published_at the first time, preserve on re-publish.
        setPublishedAt: currentStatus === 'published' ? 'preserve' : 'now',
      };
    case 'unpublish':
      return { status: 'unpublished', setPublishedAt: 'preserve' };
    case 'downgrade':
      return { status: 'draft', setPublishedAt: 'preserve' };
    default:
      return {
        status: currentStatus ?? 'draft',
        setPublishedAt: 'preserve',
      };
  }
}

/** Editor "Backdate article" control: a YYYY-MM-DD → an ISO timestamp at noon
 *  UTC (avoids timezone off-by-one; reads as mid-day in US time zones). Returns
 *  null when blank, malformed, or in the future. Only honored for editor-tier
 *  users (the UI hides the control otherwise; this is the server backstop). */
function parseBackdate(formData: FormData, role: UserRole): string | null {
  const isEditor = role === 'editor' || role === 'admin' || role === 'master admin';
  if (!isEditor) return null;
  const raw = String(formData.get('published_at_override') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const ts = Date.parse(`${raw}T12:00:00Z`);
  if (Number.isNaN(ts) || ts > Date.now()) return null;
  return new Date(ts).toISOString();
}

/**
 * Create a new story. Intent determines the resulting status — most
 * commonly 'save' (draft) for journalists, 'publish' for editors.
 */
export async function createStoryAction(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };

  const parsed = parseStoryFormData(formData);
  if (!parsed.headline) {
    return { error: 'Headline is required.' };
  }

  const intent = String(formData.get('intent') ?? 'save');
  const next = resolveNextStatus(null, intent, user.role);

  // A backdate (if provided + publishing) overrides the default "now" stamp.
  const backdate = parseBackdate(formData, user.role);
  const publishedAt =
    next.setPublishedAt === 'now'
      ? backdate ?? new Date().toISOString()
      : null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('stories')
    .insert({
      ...parsed,
      status: next.status,
      published_at: publishedAt,
      author_id: user.id,
      // Default byline to the author's display name if they left it blank.
      byline: parsed.byline ?? user.displayName ?? user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    // Log every field of the Supabase error so we can diagnose from the
    // Vercel runtime logs even when the truncated table view hides the
    // detail. PostgrestError shape: { message, details, hint, code }.
    console.error('[createStoryAction]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      userId: user.id,
      userRole: user.role,
      intent,
      nextStatus: next.status,
      payloadHeadline: parsed.headline,
      payloadCategories: parsed.categories,
    });
    // Surface the most useful piece of info in the UI. Postgres codes
    // worth knowing: 42501 = RLS / permission denied, 23502 = NOT NULL
    // violation, 23503 = FK violation, 23514 = CHECK violation.
    const detail =
      [error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' — ') || 'Failed to create story.';
    return { error: detail };
  }

  revalidatePath('/portal');
  revalidatePath('/');
  redirect(`/portal/edit/${data.id}?saved=1`);
}

/**
 * Update an existing story. Editors can edit anything; journalists can
 * only edit stories they authored. Status transitions follow the intent.
 */
export async function updateStoryAction(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };

  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Missing story id.' };

  const parsed = parseStoryFormData(formData);
  if (!parsed.headline) {
    return { error: 'Headline is required.' };
  }

  const supabase = createClient();

  // Load current row to (a) check authorship for journalists, (b) figure
  // out the right published_at handling.
  const { data: existing, error: loadErr } = await supabase
    .from('stories')
    .select('id, status, author_id, published_at')
    .eq('id', id)
    .maybeSingle();
  if (loadErr || !existing) {
    return { error: 'Story not found.' };
  }

  // Journalists can only edit their own stories.
  if (user.role === 'journalist' && existing.author_id !== user.id) {
    return { error: 'You can only edit your own stories.' };
  }

  const intent = String(formData.get('intent') ?? 'save');
  const next = resolveNextStatus(
    existing.status as 'draft' | 'submitted' | 'published' | 'unpublished',
    intent,
    user.role
  );

  // Journalists may publish/unpublish/downgrade their OWN stories (the
  // author check above already restricts them to their own work).

  // A backdate (editor-tier) overrides published_at whenever the story ends up
  // published — covers fixing the date on an already-published archive piece.
  const backdate = parseBackdate(formData, user.role);
  let published_at =
    next.setPublishedAt === 'now'
      ? new Date().toISOString()
      : existing.published_at;
  if (backdate && next.status === 'published') {
    published_at = backdate;
  }

  const { error: updErr } = await supabase
    .from('stories')
    .update({
      ...parsed,
      status: next.status,
      published_at,
    })
    .eq('id', id);

  if (updErr) {
    console.error('[updateStoryAction]', {
      message: updErr.message,
      details: updErr.details,
      hint: updErr.hint,
      code: updErr.code,
      storyId: id,
      userId: user.id,
      userRole: user.role,
      intent,
      nextStatus: next.status,
    });
    const detail =
      [updErr.message, updErr.details, updErr.hint]
        .filter(Boolean)
        .join(' — ') || 'Failed to save story.';
    return { error: detail };
  }

  revalidatePath('/portal');
  revalidatePath('/portal/all');
  revalidatePath('/');
  // Revalidate the public section pages affected by the story so freshly
  // edited content surfaces immediately instead of waiting for the 60s
  // ISR window. Only sections with their own /[section] route get
  // revalidated — sports sub-cats like /pro-sports don't have a route
  // and revalidatePath() against a non-existent path can blow up the
  // action in some Next 14 edge cases.
  if (parsed.categories) {
    for (const section of parsed.categories) {
      if (ROUTE_SECTION_SLUGS.has(section)) {
        revalidatePath(`/${section}`);
      }
    }
  }
  redirect(`/portal/edit/${id}?saved=1`);
}

/**
 * Delete a story. Journalists can delete their own; editors/admins can
 * delete any.
 */
export async function deleteStoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/portal');

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/portal');

  const supabase = createClient();

  if (user.role === 'journalist') {
    // Scope the delete to the author so we can't be tricked by a
    // forged form. Returns 0 rows affected if it wasn't theirs.
    await supabase.from('stories').delete().eq('id', id).eq('author_id', user.id);
  } else {
    await supabase.from('stories').delete().eq('id', id);
  }

  revalidatePath('/portal');
  revalidatePath('/portal/all');
  revalidatePath('/');
  redirect('/portal?deleted=1');
}
