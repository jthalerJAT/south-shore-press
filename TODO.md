# TODO

What's left to build in v2. Grouped by priority. Items in **bold** are
the ones blocking domain cutover from v1.

---

## Reader auth — recently shipped on `feat/reader-auth` (2026-05-26)

- [x] Migration `003_reader_profiles.sql` — adds first/last/phone/address +
  Stripe + subscription columns to `profiles`, adds `'reader'` to the
  role enum, installs the `handle_new_auth_user` trigger that auto-
  creates a profile row from `auth.users` insert.
- [x] `/signup` self-registration page (first/last/email/phone/address +
  password). Email confirmation required.
- [x] `/forgot-password` + `/reset-password` (Supabase magic-link reset
  via `/auth/callback`).
- [x] `/account` tabbed editor (Profile · Payment · Subscription · Security)
  with "Hi, [Name]" link in the masthead.
- [x] Stripe SetupIntent + save-card flow (conditional on
  `STRIPE_SECRET_KEY` env). UI gracefully hides when keys aren't set.
- [x] Sign-out fix — `<SignOutButton>` client wrapper uses
  `router.refresh()` so the AuthChip rehydrates after the cookie clear.
- [x] Readers section on `/portal/all/credentials` (display-only;
  search by name/email/city; shows phone/address/card/subscription
  status/signup date).

### Reader auth follow-ups (not yet built)

- [ ] **Apply migration 003 in Supabase Studio.** It's a no-op for
  data — additive columns + a new trigger + role enum value. Run as the
  whole file; Supabase auto-commits each statement so ALTER TYPE ADD
  VALUE works.
- [ ] **Enable email confirmation in Supabase Auth settings**
  (Authentication → Email Auth → "Confirm email" toggle). Already the
  default on new projects; verify it's still on.
- [ ] **Set Stripe env vars in Vercel** once the SSP Stripe account
  exists: `STRIPE_SECRET_KEY` (server-only) and
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Without them, /account → Payment
  shows a "not configured" notice and the API returns 503.
- [ ] **Stripe webhook handler** to keep `subscription_status` /
  `subscription_tier` / `subscription_started_at` in sync after a
  successful Stripe Checkout. Endpoint: `/api/stripe/webhook` with
  signature verification via `STRIPE_WEBHOOK_SECRET`.
- [ ] **Card collection on the signup form itself.** Today the card UX
  lives only on /account → Payment because the Supabase auth session
  doesn't exist between `signUp` and email confirmation. To add a card
  pre-confirmation, accept a Stripe-tokenized PaymentMethod at signup,
  store transiently keyed on the email, and attach in the
  `handle_new_auth_user` trigger (or in a one-shot handler the user
  hits on first sign-in).
- [ ] **Custom-branded reset-password email**. Today Supabase sends its
  default template. To match GPC's branded HTML, configure Supabase
  Custom SMTP (Resend) + edit the recovery template.
- [ ] **Account deletion** — give readers a "Delete my account" button
  in /account → Security that calls `supabase.auth.admin.deleteUser`
  via a server action using the service-role key.

---

## Editor Portal polish

- [ ] **Image upload** (Cloudinary). User explicitly asked to skip this
  earlier — paste-URL works for now. When ready: install `cloudinary` +
  `next-cloudinary`, build a Server Action that signs upload requests
  using `CLOUDINARY_API_SECRET`, replace the "Hero media URL" text
  input with a `CldUploadButton`. Same treatment for the "Additional
  photos" dynamic list. Needs three env vars added to Vercel:
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`.
- [ ] **Draft preview** button on the edit form. Open a new tab
  rendering the story exactly as it'll appear publicly, but accessible
  only to authed editors (not indexable). Cleanest path: a
  `/portal/preview/[id]` route that uses the same components as the
  public story page but reads the latest unsaved/draft state.
- [ ] **Drag-drop polish on Site Layout**:
  - [ ] Drag a story FROM a slot back to the left stories list
        (today: use the × button)
  - [ ] Drag a story FROM one slot to another slot
        (today: clear source via ×, drag from list to destination)
  - [ ] Reorder slot groups themselves (e.g. move Sports above Local)
- [ ] **Section page consumption of pins.** Today the homepage reads
  `home.*` pins. Section pages (`/local`, `/sports`, etc.) still use
  pure recency — wire them up to consume `section.<slug>` pins (the
  Site Layout UI already writes them; just need to read them in
  `app/[section]/page.tsx`).
- [ ] **Bulk publish / delete** in `/portal/all/edit-stories` — select
  multiple rows + apply action. Quality-of-life when there are 30+
  stories/day.
- [x] **First/last name on profiles.** Added in migration 003 (reader
  auth) alongside phone + address columns. Editorial flows still split
  `display_name` for back-compat; can be migrated to read `first_name` /
  `last_name` directly when convenient.

---

## Real public pages (replace placeholders)

- [ ] `/email-briefings` — currently a "coming soon" stub. Needs a
  real signup form (name + address + email) writing to a new
  `email_subscribers` table, then connected to whatever sending
  platform you choose (SendGrid / Postmark / etc.).
- [ ] `/subscribe` — paid subscription flow with Stripe checkout.
  Tiers TBD (digital-only / digital + print).
- [ ] `/about`, `/contact`, `/advertise`, `/privacy`, `/terms` —
  static content pages (footer links). All currently 404. Could be
  MDX files for quick editing.
- [ ] `/search` — real search backend. Options: Postgres FTS via a
  generated tsvector column on `stories`, or hosted (Algolia /
  Meilisearch). At 30 articles/day, FTS is plenty.

---

## Original phase roadmap (still pending)

- [ ] **Phase 4: Performance / Image host lockdown.**
  - Tighten `next/image` `remotePatterns` to specific hosts (S3 bucket
    + YouTube thumb + Cloudinary if/when wired)
  - Tune ISR `revalidate` per page type (story = 60s OK; section page
    might be 30s; homepage maybe 30s for breaking news)
  - Verify edge cache headers via `curl -I`
  - Audit Lighthouse scores once a real story load is on the page
- [ ] **Phase 6: Social integrations.**
  - X (Twitter) embed support inside story bodies (parse pasted URLs)
  - YouTube embed inside story bodies (similar pattern to hero)
  - Instagram embed
  - Share buttons on story pages (X / Facebook / Email / Copy Link)
  - OG/Twitter Card verification with a real story URL via
    opengraph.xyz or Twitter's card validator
- [ ] **Phase 7: Ad slots + analytics.**
  - Reserved `<AdSlot id="..." />` components in story / homepage /
    section page layouts. Configurable per-network later.
  - Vercel Analytics (already part of the Vercel plan)
  - GA4 OR Plausible (pick one) for editorial reporting
  - Ad-platform integration (GAM / Mediavine / Raptive — TBD)
- [ ] **Phase 8: Domain cutover.**
  - DNS swap from v1 to v2
  - 301 redirects from `/story/<uuid>` (v1) to `/<section>/<slug>-<hex>`
    (v2) so existing backlinks don't break
  - Submit `/sitemap.xml` + `/news-sitemap.xml` to Google Search Console
  - Apply to Google News Publisher Center
  - Decommission v1 deploy

---

## Visual / chrome refinements (post-launch)

- [ ] Real logo file optimization (current `public/logo.png` was the
  one you uploaded — verify file size + dimensions are optimal for
  retina at h-[120px] desktop / h-9 mobile)
- [ ] Mobile QA on real devices (iPhone Safari, Android Chrome).
  Phase 5.5 made everything responsive but a manual pass is wise.
- [ ] **Slug column on `stories`.** Today URLs use 8-char-hex suffix
  (`/local/some-headline-7a3b2c1d`). Adding a real `slug` column +
  unique index makes URLs cleaner (`/local/some-headline-2026`),
  needs a backfill migration and URL builder swap.

---

## Operational / dev experience

- [ ] **`SUPABASE_SERVICE_ROLE_KEY` env var** (server-only) — useful
  for admin-tier server actions that need to bypass RLS (e.g. an
  admin reading a profile that RLS would normally hide). Today every
  query goes through the user's auth context.
- [ ] **`@dnd-kit/sortable`** — only `@dnd-kit/core` and `utilities`
  are installed today. If we add slot-to-slot reordering, we'll need
  sortable too.
- [ ] **TypeScript strictness** — `tsconfig.json` could enable
  `noUncheckedIndexedAccess` for safer array access; would catch a
  few latent issues.
- [ ] **Local lint hook** — `npm run lint` exists but isn't enforced.
  A pre-commit hook (husky + lint-staged) would catch issues before
  the Vercel build.

---

## Known issues / quirks

- **No image upload yet** (see top of file)
- **Pinned story must be in the recent pool.** `getAllPins` references
  story IDs; `resolveSlotStories` filters by what's in the fallback
  list. If you pin a 6-month-old story, it may not be in the latest 50
  and will silently fall back to recency. Fix: pre-fetch pinned stories
  by ID. Low priority — editor would notice and re-pin.
- **Vercel log table truncates messages.** When debugging a server
  action failure, use the Vercel MCP with the `query` parameter to
  search for the specific error code (e.g. `42P01`, `42P17`, `23502`).
- **RLS recursion landmine** — if you ever write a policy on a table
  that needs to consult the same table, use a `SECURITY DEFINER`
  helper function. The pattern is in
  `db/migrations/002_profiles_roles_array.sql`. Inline `EXISTS
  (SELECT FROM same_table ...)` will cascade-break the entire site.
  This was the bug that took the site down on 2026-05-25 — see commit
  `5deb2c9`.
- **Editor portal access depends on `profiles.role` (legacy single
  column).** RLS policies still read the legacy enum, not the new
  `roles` array. The JS code keeps `role` in sync (= highest-priv role
  from `roles[]`) so this works, but if you ever stop syncing `role`,
  RLS policies will silently grant/deny based on stale data. Long-term
  cleanup: migrate RLS to read from `roles[]`.

---

## Bookmarks worth checking before you start a session

- Vercel project: `jat-capital/south-shore-press` →
  https://vercel.com/jat-capital/south-shore-press
- Supabase project: `pfjuqfybqkepyuuwwnnb` →
  Supabase Studio (URL in your Supabase dashboard)
- v1 source (reference only): https://github.com/jthalerJAT/southshorepress
- v1 production (still live until cutover):
  https://southshorepress.vercel.app
