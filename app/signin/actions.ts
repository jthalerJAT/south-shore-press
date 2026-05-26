'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, canManageAllStories } from '@/lib/auth';

/**
 * Server Action: sign in with email + password. Called from the
 * /signin form. On success, redirects to `next` if one was specified
 * (deep-link round trip), otherwise picks a sensible default based on
 * the user's role:
 *   - Editorial (journalist+) → /portal
 *   - Reader                  → /account
 *
 * On failure, returns the error so the form can display it.
 *
 * The Supabase server client writes the session cookie automatically
 * via the cookie callbacks in lib/supabase/server.ts. Middleware keeps
 * them fresh from there on.
 */
export async function signInAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  // Empty string means "no explicit next — pick based on role".
  const explicitNext = String(formData.get('next') ?? '').trim();

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Don't leak which half was wrong (email vs password) — generic msg.
    return { error: 'Invalid email or password.' };
  }

  // Make sure RSC re-reads the new auth state on the next nav.
  revalidatePath('/', 'layout');

  let target = explicitNext;
  if (!target) {
    // No deep-link target — choose by role.
    const user = await getCurrentUser();
    if (user && (canManageAllStories(user.role) || user.role === 'journalist')) {
      target = '/portal';
    } else {
      target = '/account';
    }
  }

  redirect(target);
}

/**
 * Server Action: sign out. Wipes Supabase session cookies and bounces
 * to the homepage.
 */
export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
