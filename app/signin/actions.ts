'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Action: sign in with email + password. Called from the
 * /signin form. On success, redirects to `next` (defaults to /portal).
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
  const next = String(formData.get('next') ?? '/portal');

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
  redirect(next);
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
