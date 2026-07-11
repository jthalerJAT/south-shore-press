# TODO

What's left to build in v2. Grouped by priority. Items in **bold** are
the ones blocking domain cutover from v1.

---

## Newspaper print PDF — deferred items

- [ ] **Printer CMYK color profile (revisit down the road).** The press-PDF
  export (`scripts/export-issue-pdf.mjs`) converts to PDF/X-1a CMYK. Right now
  it uses the default/bundled CMYK profile (Ghostscript `default_cmyk.icc` or
  Adobe's US Newsprint SNAP 2007 if installed) — the printer has **not** given
  us a profile yet, and may not have one. When/if he provides an `.icc`, drop it
  in `scripts/pdfx/` and point `CMYK_ICC` at it for accurate newsprint color.
  Until then, default settings are intentional and fine. (Decided 2026-07-11.)

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

## Legals — shipped 2026-06-10

Public `/legals` PDF viewer + editor-portal upload + notarized-copy
request. Live in code on `main`; migration `006_legals.sql` applied and
the public `legals` Storage bucket created.

- [x] Public `/legals`: date dropdown → side-by-side two-page react-pdf
  viewer (arrows + page numbers) → Print / Download / Request Notarized
  Copy.
- [x] Editor portal "Legals Upload" tile: list (date · link · delete) +
  "+ Add New Legal File" (month/day/year + drag-drop PDF; browser →
  Supabase Storage via a signed upload URL).
- [x] "Request Notarized Copy" form → saves to `notarized_copy_requests`
  + (when email is on) emails all admins + `legals@southshorepress.com`.

### Legals follow-ups (not yet done)

- [ ] **Wire the outbound Resend email — DO AFTER THE DOMAIN CUTOVER.**
  The notarized-copy request currently SAVES every submission but does
  NOT email anyone yet. Turning on Resend means adding DNS records to
  `southshorepress.com`, which is still managed by the third-party vendor
  running the old site (who must not learn about the replacement yet).
  Once `southshorepress.com` is ours: add the domain in Resend → add its
  DKIM/SPF DNS records (on a `send.` subdomain — won't touch the website
  or existing Google Workspace email) → create `legals@southshorepress.com`
  as a Google Workspace alias → set `RESEND_API_KEY`, `LEGALS_FROM_EMAIL`,
  `LEGALS_NOTIFY_EMAIL` in Vercel → redeploy. (Code already degrades
  gracefully: no key = request saved, email skipped.)
- [ ] **Interim visibility of requests.** Until the email is wired,
  notarized-copy submissions are only visible in the Supabase
  `notarized_copy_requests` table. Add a "Requests" view in the portal
  (`/portal/all/legals`) so admins can see them without email or SQL.

---

## Metered paywall (proposed 2026-05-26)

Limit readers to N free articles/month before requiring a paid
subscription. Most of the schema is already in place from migration
003 — this is mostly UI + Stripe wiring.

**Already done (groundwork):**
- `profiles.subscription_status` / `subscription_tier` /
  `subscription_started_at` / `stripe_customer_id` /
  `has_payment_method` columns
- `/account → Payment` card capture via SetupIntent
- `/account → Subscription` tab reads `subscription_status` and shows
  a CTA to `/subscribe` when on the free tier
- Stripe server SDK + client SDK installed; env-var gating already
  in `getStripe()` / `isStripeEnabled()`

**Still to build:**
- [ ] **View counter.**
  - Logged-in: `profiles.monthly_view_count` int + `view_count_reset_at`
    timestamptz. Increment server-side on /[section]/[slug] render
    (server action triggered from the page component). Reset on the 1st
    of each month via a lazy check on increment.
  - Anonymous: a long-lived first-party cookie holds an opaque id;
    server stores counts in a small `anon_views` table keyed on (cookie_id,
    year_month). Cookie can be cleared (acceptable leak per NYT-style
    norms — most users won't bother).
- [ ] **Gated render in `app/[section]/[slug]/page.tsx`.**
  - Compute remaining free views server-side.
  - If `subscription_status === 'active'` → full body, no gate.
  - Else if remaining > 0 → full body + decrement + soft banner.
  - Else → first ~200 words + `<PaywallOverlay>` (CTA to /subscribe).
- [ ] **Real `/subscribe` page** (currently a 404 stub).
  - Display tier(s) + monthly / annual pricing.
  - On click: server action creates a Stripe Checkout Session keyed to
    the user's `stripe_customer_id`, redirects to Stripe-hosted checkout.
  - Success URL → `/account/subscription?welcome=1`.
- [ ] **Stripe webhook** at `/api/stripe/webhook` (also blocks paid
  card-on-file flow from the reader-auth follow-ups list).
  - Listens for `customer.subscription.created` / `.updated` /
    `.deleted` / `invoice.payment_failed` events.
  - Verifies signature with `STRIPE_WEBHOOK_SECRET`.
  - Updates `profiles.subscription_status` + `_tier` + `_started_at`
    on the matching profile (lookup by `stripe_customer_id`).
- [ ] **SEO escape hatch.** Google de-ranks paywalled content unless
  you either (a) use Google's "Flexible Sampling" JSON-LD markers
  (`isAccessibleForFree: false` + `cssSelector: ".paywall"`), or
  (b) detect Googlebot UA and serve the full body. Most news sites
  use (a). Without this, organic search traffic tanks.
- [ ] **Decision work (not coding):** pricing (free article count per
  month, monthly vs annual tiers, intro discount, NY State sales tax
  handling, refund policy). Half a day of focused setup once the
  product side is decided.

**Estimated implementation:** half a day to one focused session for
the MVP (single subscription tier, 5 free articles/month, hard wall,
no SEO escape hatch yet). Add SEO + multi-tier in a follow-up.

---

## Wishlist — Print Edition Issue Builder

A weekly 32-page printed paper currently goes to the printer as a
PDF assembled in third-party layout software (InDesign or similar).
**End goal: replace that workflow entirely** — build the issue inside
the editor portal, generate the final print-ready PDF from there,
and retire the external layout app.

Reviewed the May 27, 2026 issue (32 pages). Page-template catalog:
- **Front cover / Sports back cover** (p1, p32) — hero photo + giant
  headline + 3-teaser strip. Same template, different brand.
- **Standard editorial** — 1-3 stories with photos + display ads.
- **Op-ed / columns** (p2, p4) — 1-2 column opinion + display ad.
- **Recurring contributor column** (p15 "Ask Nancy") — Q&A with
  author headshot.
- **South Shore Living** (p22) — sponsored real-estate column +
  Recent Listings / Recent Sales ad blocks (recurring weekly).
- **This Week in History** (p23) — date-column timeline.
- **Classifieds** (p20) — text + small display ad grid.
- **Legal Notices** (p18) — multi-column dense legal text. Submitted
  today via `legals@southshorepress.com`.
- **Comics "Funny Pages"** (p25) — 6-strip grid.
- **Full-page house promo** (p3) — single-image full-page.

Most pages are *recurring slots* — editor swaps content into a fixed
template each week, not bespoke design.

### Phase 1 — Issue Builder MVP (~3 days)
- [ ] New `/portal/all/issue-builder` page. Same dnd-kit pattern as
  Site Layout: list of stories/ads/legals on the left, 32 pages on
  the right. Each page has a `template` field (front, editorial,
  op-ed, sports, legals, classifieds, comics, full-page-ad).
- [ ] Drag stories/ads/legals into per-template slots.
- [ ] Export a JSON manifest + a printable PDF table-of-contents
  ("page X: story Y, ad Z, …") that the layout-software operator
  uses as a shopping list. Useful even before full PDF generation.

### Phase 2 — Ad portal (~1 day)
- [ ] New `ad_sales` role. Upload form: advertiser name, image,
  dimensions, target section, week-of-issue (or "every week").
- [ ] `ads` table with status (draft / approved / published) and a
  weekly schedule.
- [ ] Approved ads show as draggable chips in Phase 1's Ad column.
- [ ] Recurring weekly ads (John Liberti Real Estate, Vector Sports,
  etc.) auto-place themselves into their usual slot each issue —
  editor only confirms.

### Phase 3 — Legals intake (~1 day)
- [ ] Replace the `legals@southshorepress.com` email workflow with
  a structured submission form (advertiser, notice text, publication
  date(s), billing info).
- [ ] `legal_notices` table. Editor approves; on issue day, approved
  notices auto-flow into the Legal Notices page template at the
  correct point size + column width.
- [ ] Per-publication billing report for AR.

### Phase 4 — PDF generation (~1-2 weeks, the big one)
This is the "retire the external layout app" payoff.
- [ ] HTML+CSS templates per page type using print-specific CSS
  (`@page`, `size: tabloid` or whatever broadsheet dims, bleed,
  crop marks). Tailwind handles most of it; a print stylesheet
  overrides the on-screen settings.
- [ ] Puppeteer-based renderer: feeds each page template + its
  manifest content → PDF page. Concatenate all 32 into the final
  issue PDF via `pdf-lib` or `pdftk`.
- [ ] Photo handling: source images from Cloudinary (when wired)
  at print resolution (300 DPI minimum) with proper crop boxes.
- [ ] Comics are publisher-supplied images — passthrough.
- [ ] Image-flattened legal notices (if any come in as PDFs)
  spliced into the output via pdf-lib's `mergePdf`.
- [ ] Print quality gotchas: HTML→PDF renders in sRGB by default,
  not CMYK. Most community-paper newsprint printers accept sRGB
  PDFs and convert in their prepress; confirm with your printer
  before relying on this. If they require CMYK, swap Puppeteer for
  WeasyPrint or Prince (commercial, ~$3.8K/yr) which support proper
  color management.

### Phase 5 — Polish + ops
- [ ] "Preview issue" — render a low-res PDF for editor proofing
  before committing to the print-quality render.
- [ ] Version history per issue (so a recall / late-stage edit can
  re-render from a known state).
- [ ] Send-to-printer integration: SFTP / email-to-print API,
  whatever the printer accepts.
- [ ] Issue archive — past issues browsable from `/print-archive`
  on the public site, with PDF download per issue.

**Estimated total:** 3-4 weeks of focused work for the full
end-to-end. Phases 1+2+3 alone (~5-7 days) deliver a clear win
even if Phase 4 is deferred or scaled back. Phase 4 is the
"retire InDesign" line — start it once Phases 1-3 are battle-tested
on a few issues so we know the manifest model is right.

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
  - **Wire the Legals Resend email** (add Resend DKIM/SPF records to
    `southshorepress.com` + set `RESEND_API_KEY` / `LEGALS_FROM_EMAIL` /
    `LEGALS_NOTIFY_EMAIL` in Vercel). Deferred until now so the current
    vendor isn't tipped off — see "Legals follow-ups" above.
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
