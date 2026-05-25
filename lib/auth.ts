import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side auth helpers. Use from React Server Components, Route
 * Handlers, and Server Actions. The cookie store is read via the
 * @supabase/ssr server client; middleware ensures the cookies are fresh.
 *
 * Role discriminator is `profiles.role` ∈ { 'journalist', 'editor',
 * 'admin' } (lowercase strings, mirrors v1).
 */

export type UserRole = 'journalist' | 'editor' | 'admin';

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
};

/** Best-effort fetch of the signed-in user's auth row + profile. Returns
 *  null when the request is anonymous OR when no profile row exists yet
 *  (which would be a data-integrity issue, but doesn't crash the page). */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    // Normalize defensively in case any legacy row has uppercase values.
    role: String(profile.role).toLowerCase() as UserRole,
  };
}

/** Redirect to /signin if not authenticated; return the user otherwise.
 *  `returnTo` is round-tripped through a ?next= param so the user lands
 *  back where they were trying to go after signing in. */
export async function requireUser(returnTo: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(returnTo);
    redirect(`/signin?next=${next}`);
  }
  return user;
}

/** Like requireUser, but also enforces that the user has one of the
 *  allowed roles. Sends them to /portal (with a flash message hint) if
 *  they're signed in but lacking privileges, rather than to /signin. */
export async function requireRole(
  allowedRoles: ReadonlyArray<UserRole>,
  returnTo: string
): Promise<AuthenticatedUser> {
  const user = await requireUser(returnTo);
  if (!allowedRoles.includes(user.role)) {
    redirect('/portal?denied=1');
  }
  return user;
}
