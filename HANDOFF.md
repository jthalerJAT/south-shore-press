# Handoff Notes — Design Decisions + Gotchas

The README tells you what's where. This file tells you **why it's like
this**, so you don't accidentally undo a careful decision when picking
up a new feature.

Written 2026-05-25 at the end of a long session. Update as you go.

---

## How to resume on a fresh workstation

The user works across multiple machines. Local clones often lag origin
by days or weeks. Steps:

```bash
# 1) pull (or re-clone)
git pull origin main
# or
git clone https://github.com/jthalerJAT/south-shore-press

# 2) install
npm install

# 3) read in this order:
# - README.md          (overview + file map)
# - HANDOFF.md         (this file — decisions + gotchas)
# - TODO.md            (what's left)
# - recent commit log: git log --oneline -30
```

You won't have local Supabase credentials by default — pull them from
Vercel's env-vars dashboard or the Supabase project console and put in
`.env.local`. Or just push to Vercel and test in deploy previews.

---

## Why we're using v1's Supabase

v1 (the Vite SPA at `jthalerJAT/southshorepress`) is still serving
production at `southshorepress.vercel.app`. v2 reads the same DB so
editors don't have to dual-publish during the transition. **Don't drop
or rename columns that v1 reads**:

- `stories.*` — every field is used by both
- `profiles.role` — still read by v1 for permissions. v2 keeps it in
  sync (writes the highest-priv role from `roles[]` into it)

What v2 added (additive only, doesn't break v1):
- `profiles.roles text[]` — multi-role array
- `site_layout_pins` — new table, v1 doesn't know about it

---

## RLS recursion landmine (the bug that took us down)

**Date:** 2026-05-25, ~9 PM. Symptoms: homepage went blank, login
broke, all queries failed.

**Root cause:** I wrote a SELECT policy on `profiles` that did an
inline `EXISTS (SELECT 1 FROM profiles me WHERE me.id = auth.uid()
AND me.role IN ('admin', ...))`. PostgreSQL re-triggered the SELECT
policy on the inner query → infinite recursion → error `42P17`.
Cascaded across every table that touches profiles (which is
everything — stories' RLS checks profiles for editor permissions;
`site_layout_pins` checks profiles for the same reason; even
`getCurrentUser` checks profiles for the role).

**Fix:** wrap the admin check in a `SECURITY DEFINER` function:

```sql
CREATE OR REPLACE FUNCTION public.is_credentials_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER  -- ← key: runs as function owner (postgres), skips RLS
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND replace(lower(role::text), '_', ' ')
          IN ('admin', 'master admin')
  );
$$;

CREATE POLICY "admins can read all profiles"
  ON profiles
  FOR SELECT
  USING (public.is_credentials_admin(auth.uid()));
```

**Rule going forward:** any RLS policy on table T that needs to check
T (or a table that itself has RLS referencing T) must use a SECURITY
DEFINER helper. Never inline an `EXISTS (SELECT ... FROM same_table)`.

---

## Why FK joins cast through `unknown`

`@supabase/postgrest-js` types FK relations as arrays even when the
cardinality is many-to-one. So when we `select('id, headline,
author:profiles!stories_author_id_fkey(display_name)')`, the inferred
TS type has `author: { display_name }[]` — but the runtime returns a
single object because there's exactly one author per story.

If you do `as StoryDetail` directly, TS rejects with "neither type
sufficiently overlaps." The escape hatch is:

```ts
return ((data ?? null) as unknown as StoryDetail | null) ?? null;
```

Used in `lib/queries/stories.ts` and `lib/queries/editor-stories.ts`.
Don't remove these — the type assertion is correct; Supabase's
inference is the thing that's wrong.

---

## Why we don't use Cloudinary yet

User explicitly asked to skip it. We discussed it (Cloudinary is the
right tool for a news site — better image optimization than `next/
image` alone, smart crop, automatic AVIF/WebP, etc.) but deferred the
work. Today, editors paste URLs into the "Hero media URL" and "+ Add
another photo" fields. Photos can be from anywhere (S3, Cloudinary if
they upload manually, etc.).

When picking this up: env vars needed are
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (public), `CLOUDINARY_API_KEY`
(server only), `CLOUDINARY_API_SECRET` (server only). Use the
`next-cloudinary` package + `CldUploadButton` with signed uploads via
a Server Action that generates the signature.

---

## Slug URLs (and why they have a hex suffix)

URL pattern: `/<section>/<headline-slug>-<8charHex>` —
e.g. `/local/budget-vote-passes-7a3b2c1d`.

Why: the v1 `stories` table doesn't have a `slug` column. Adding one
requires a migration + backfill + URL-builder swap, which we deferred.
The 8-char hex (first 8 chars of the UUID) is the actual lookup key;
the slug portion is for humans + search engines.

Detail-page lookup uses a byte-range query on the uuid column
(`id >= '<short>-0000-...' AND id <= '<short>-ffff-...'`) — Postgres
uuid comparison is lexicographic so this matches the right range and
uses the PK index. **Don't** try to revive `.filter('id::text', 'like',
prefix)` — PostgREST doesn't accept `column::type` cast in `.filter()`,
and that was the bug in commit `5bd72ff`.

---

## Why some Server Actions return `{error}` and others throw redirect()

Server Actions that mutate then redirect:
- On success: call `redirect(...)` — Next.js throws a special
  `NEXT_REDIRECT` error that propagates up and short-circuits rendering
- On failure: `return { error: ... }` — the caller (a form using
  `useFormState`) renders the error in the UI

So you'll see actions that look like:

```ts
const { error } = await supabase.from(...).update(...);
if (error) return { error: error.message };
revalidatePath('/portal');
redirect('/portal');
```

That's intentional. The implicit Promise return type is
`Promise<{error: string} | never>` — the redirect path never returns
because it throws. TypeScript handles this fine.

---

## Why the AuthChip is a client component

The masthead has the user's name + role + Sign Out button top-right.
If we put that in a server component, it'd be baked into the ISR-cached
HTML — every visitor of a cached page would see the SAME user info.
Bad. So:

- AuthChip is a Client Component
- It renders `Sign In` by default (SSR-safe — same for all visitors)
- On mount, it `fetch('/api/me')` to get the current user
- Swaps to the signed-in view if found

The `/api/me` route is marked `dynamic = 'force-dynamic'` so it's
never cached. Tiny request — cookie-only auth check.

Also: `usePathname()` is included in the useEffect dep array so the
chip re-fetches on every SPA navigation. Without that, signing in
wouldn't refresh the chip until a hard reload (the root layout
persists across page navs in App Router).

---

## Why the homepage queries fetch a broad pool

`getLatestPublishedStories(50)` — we don't actually need 50 stories
for the homepage (5 hero + 10 top stories + 4×7 sections = 43 slots
max). But `resolveSlotStories` needs the pinned story to be IN the
fallback pool to render it. Pinning a 6-month-old story → it won't be
in the latest 50 → silently falls back to recency.

This is a known limitation. Fix is `getStoriesByIds(pinnedIds)` and
merge into the pool. Low priority because editors typically pin recent
stories anyway. Documented in `TODO.md`.

---

## Why `roles[]` doesn't include `'master admin'` in the UI

The Credentials page shows 3 checkboxes (Admin / Editor / Journalist).
Master admin is intentionally **not** a checkbox:
- Anyone with admin tier could otherwise grant themselves master admin
- Master admin is supposed to be a small, fixed set of trusted accounts

So master admin can only be granted via direct SQL. The server action
preserves the master admin role on any update — if the target was
master admin before, they stay master admin after, regardless of what
the request body says.

To grant master admin to a new user, run in Supabase SQL Editor:

```sql
UPDATE profiles
SET role = 'master admin',
    roles = ARRAY['master admin']
WHERE email = 'them@example.com';
```

(Adjust `role` value to match your enum — `'master_admin'` if the
enum uses underscore.)

---

## Why the section list is hardcoded in two places

`SITE_SECTIONS` (in `lib/site-config.ts`) is the single source of
truth for the 9 reader-facing sections. But:

- `HOMEPAGE_SECTION_SLUGS` in `app/page.tsx` is a separate ordered
  list of which sections appear on the homepage rails. It's a
  **subset + ordering** of `SITE_SECTIONS` — e.g. `video-vault`
  appears first (user request), `legals` doesn't appear at all on
  the homepage.

If you add a section in `site-config.ts`, also add it to
`HOMEPAGE_SECTION_SLUGS` if you want it on the homepage.

---

## Things that look broken but aren't

- **"Cloudinary credentials not set" never appears** — there's no
  Cloudinary code yet. See "Why we don't use Cloudinary yet" above.
- **404 on `/about`, `/contact`, `/advertise`, `/privacy`, `/terms`,
  `/email-briefings/signup`, `/subscribe/plans`, `/search?q=...`** —
  these are intentionally placeholders. Footer links go to the
  placeholder shell pages; deeper paths 404. See `TODO.md`.
- **Story-detail pages 404 for very-old story IDs** — the URL lookup
  uses the first 8 hex chars of the UUID. If two stories happen to
  share that prefix (1-in-4-billion odds), the more-recent one wins.
  Not a real problem at current scale.
- **Vercel "destructive command" warning when running migrations** —
  it's because of `DROP POLICY IF EXISTS` lines. They're no-ops on
  first run and idempotent on re-runs. Safe.

---

## Things that ARE broken (track in TODO.md, don't be surprised)

- Cloudinary not wired (paste-URL only)
- Draft preview not built
- Section pages don't consume their `section.<slug>` pins yet
  (homepage does; section pages still pure recency)
- Drag-back-to-list and slot-to-slot drag on Site Layout aren't
  implemented (× button + drag-from-list works as a workaround)
- Real search backend not built
- No image upload UI; no real subscribe flow; no real email
  briefings signup
