# The South Shore Press — v2

Online news site for Long Island's South Shore. **v2** is the active
codebase; v1 (`jthalerJAT/southshorepress`) is the original Vite SPA
still serving production at <https://southshorepress.vercel.app> until
domain cutover.

| | |
|---|---|
| **Live (v2)** | <https://south-shore-press.vercel.app> |
| **Live (v1, current prod)** | <https://southshorepress.vercel.app> |
| **GitHub** | <https://github.com/jthalerJAT/south-shore-press> |
| **Vercel** | jat-capital / south-shore-press |
| **Supabase** | `pfjuqfybqkepyuuwwnnb` (shared with v1) |

---

## Stack

- **Next.js 14 App Router** + TypeScript + React Server Components.
  Server-rendered HTML so Google News + social scrapers see real
  content, not a JS shell.
- **Tailwind CSS** + a handful of shadcn-style primitives. Mobile-first.
- **Supabase** — Postgres + Auth (via `@supabase/ssr`) + RLS. Same
  project as v1; v2 reads/writes the same `stories` / `profiles`
  tables. v2 added `site_layout_pins` and `profiles.roles` columns
  (see `db/migrations/`).
- **@dnd-kit/core** + `@dnd-kit/utilities` — for the Site Layout
  drag-drop editor.
- **next/font/google** — Playfair Display (headlines) + Source Sans 3
  (body/UI), self-hosted. No runtime Google Fonts request.
- **Vercel** — hosting, edge cache, image optimization, runtime logs.
  ISR (`revalidate = 60` on public pages) absorbs traffic spikes.

---

## Resuming this project on a new workstation

1. **Pull from GitHub** — local clones across machines may be far
   behind. Always `git pull origin main` (or re-clone) before editing.
2. **Read in this order to get oriented:**
   - This README (top-level overview)
   - [`TODO.md`](./TODO.md) — what's left to build + known issues
   - [`HANDOFF.md`](./HANDOFF.md) — design decisions, gotchas, "why
     it's like this" notes that aren't obvious from the code
3. **Skim the key directories** (see [Layout](#layout) below).
4. **If picking up a specific feature**, the relevant commit messages
   in `git log` are detailed — search by keyword (e.g. `git log
   --grep="Site Layout"`).

---

## Layout

```
app/
  page.tsx                    Homepage (hero carousel + Top Stories rail + section blocks)
  layout.tsx                  Root layout — Playfair/Source Sans 3, SiteHeader, SiteFooter, JSON-LD
  not-found.tsx               Styled 404
  api/
    me/route.ts               Returns current user JSON (used by AuthChip client component)
  [section]/
    page.tsx                  /local, /sports, etc. — category index
    [slug]/page.tsx           Individual story page (full SEO + JSON-LD NewsArticle + BreadcrumbList)
  email-briefings/page.tsx    Placeholder (signup form coming later)
  subscribe/page.tsx          Placeholder
  search/page.tsx             Placeholder (real search backend later)
  signin/                     Email/password sign-in flow + server actions
  portal/
    page.tsx                  "Story Editor" — current user's DRAFTS only
    new/page.tsx              Create new story
    edit/[id]/page.tsx        Edit story (full role-aware workflow buttons)
    actions.ts                createStoryAction / updateStoryAction / deleteStoryAction
    all/
      page.tsx                Editor Portal landing — 3 tiles
      edit-stories/page.tsx   Sortable + searchable + filterable table of every story
      credentials/            Admin role manager (multi-role w/ master-admin tier protection)
        page.tsx
        actions.ts            setUserRolesAction
      site-layout/            Drag-drop pin editor for homepage slots
        page.tsx
        actions.ts            setPinAction / clearPinAction
  sitemap.ts / robots.ts      Auto-generated sitemap + robots
  news-sitemap.xml/route.ts   Google News sitemap (custom XML format)

components/
  site/
    site-header.tsx           4-corner masthead (Email Briefings · clock · auth chip · Subscribe)
    site-footer.tsx           White, 4-column (Brand · Sections · More · Company)
    auth-chip.tsx             Client hydrates auth state via /api/me
    header-clock.tsx          Live time/date in EST
  seo/
    global-jsonld.tsx         Organization + WebSite schema in every page
  story/
    hero-carousel.tsx         Homepage 5-story rotating hero (auto-advance + pause on hover/focus)
    top-stories-rail.tsx      Headlines-only sidebar rail next to hero
    story-card.tsx            Reusable card (16:10 image, bottom-justified byline+date)
    section-rail.tsx          "Local / Sports / etc." rows below hero
    hero-media.tsx            Renders photo via next/image OR YouTube iframe
  portal/
    portal-shell.tsx          Top chrome for /portal/* pages (back arrow + tabs + sign out)
    back-link.tsx             Reusable "← Back to X" link
    story-form.tsx            Big create/edit form with role-aware workflow buttons
    stories-table.tsx         Simple table (used by /portal for drafts)
    all-stories-view.tsx      Full filter UX (used by /portal/all/edit-stories)
    status-badge.tsx          DRAFT / SUBMITTED / PUBLISHED / UNPUBLISHED pill
    credentials-table.tsx     Sticky-header table with checkboxes + save + confirm modal
    site-layout-board.tsx     dnd-kit drag-drop slot editor

lib/
  supabase/
    server.ts                 RSC + Server Action client (reads cookies via @supabase/ssr)
    client.ts                 Browser client (for any client-side subscription needs)
    middleware.ts             Cookie refresh on every request (used by /middleware.ts)
  queries/
    stories.ts                Public reads: getLatestPublishedStories, getTopStories,
                              getPublishedStoriesBySection, getPublishedStoryByShortId
    stories-meta.ts           Lightweight queries for sitemap routes
    editor-stories.ts         Editor reads: getStoriesAuthoredBy, getMyDrafts,
                              getAllStoriesForEditor, getStoryForEdit
    profiles.ts               getAllProfiles for the credentials page
    site-layout.ts            getAllPins, getPinsForSlot, resolveSlotStories
  auth.ts                     getCurrentUser, requireUser, requireRole, role helpers
                              (canManageCredentials, canManageUser, canManageRole,
                              isMasterAdmin, pickHighestRole, normalizeRole)
  site-config.ts              SITE name/tagline, SITE_SECTIONS list, social URLs
  site-url.ts                 getSiteOrigin() — used by sitemap + JSON-LD @id fields
  slugify.ts                  URL pattern: /<section>/<headline-slug>-<8charHex>
  youtube.ts                  parseYouTubeId, embed/thumbnail URL helpers
  utils.ts                    cn() — clsx + tailwind-merge

db/migrations/
  001_site_layout_pins.sql    site_layout_pins table + RLS
  002_profiles_roles_array.sql profiles.roles text[] + RLS (via SECURITY DEFINER fn)

middleware.ts                 Next.js middleware — refreshes Supabase auth cookies
```

---

## Local development

```bash
cp .env.local.example .env.local
# fill in:
#   NEXT_PUBLIC_SUPABASE_URL=https://pfjuqfybqkepyuuwwnnb.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Vercel env or Supabase dashboard>
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000  # for absolute URLs in sitemap

npm install
npm run dev
```

Open <http://localhost:3000>.

---

## Deploy

- Auto-deploys on push to `main` via the Vercel project. ~30-60s build.
- **Required env vars** in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL` (production domain, used in sitemap + JSON-LD)
- **Domain alias** today: `south-shore-press.vercel.app`. Cutover from
  v1's `southshorepress.vercel.app` is Phase 8 (pending).

---

## Database migrations

Migrations live in `db/migrations/`. They're **not auto-applied** —
paste into Supabase Studio's SQL Editor manually.

| File | What it does | Status |
|---|---|---|
| `001_site_layout_pins.sql` | Creates `site_layout_pins` table for editor pinning | ✅ Run |
| `002_profiles_roles_array.sql` | Adds `profiles.roles text[]` + SECURITY DEFINER admin check | ✅ Run |

**Hard rule for new migrations:** any RLS policy that needs to consult
the same table it's defined on **must** use a `SECURITY DEFINER`
helper function. Inline `EXISTS (SELECT FROM same_table ...)` causes
`42P17` infinite-recursion errors that cascade across every table that
joins to the same one. See the comment block in
`002_profiles_roles_array.sql` for the pattern.

---

## Roles + Permissions

Stored in `profiles.roles text[]` (one user can have multiple). The
legacy `profiles.role` enum column is kept in sync (set to the
highest-priv role from `roles[]`) so v1 continues to work.

| Role | Can | Cannot |
|---|---|---|
| `journalist` | Edit own drafts; submit for review | Publish; see other journalists' work |
| `editor` | Edit/publish/unpublish any story; downgrade to draft | Manage user roles |
| `admin` | Everything editor can + manage editor/journalist roles on non-admin users | Modify other admins; grant/revoke Admin role |
| `master admin` | Anything in the UI except modify another master admin | (Master admin status only changes via direct SQL) |

The `canManageUser` and `canManageRole` helpers in `lib/auth.ts`
enforce the hierarchy server-side. The Credentials UI mirrors the
same logic for disabled checkboxes.

---

## What's done

Walking through commit history is the best way to see this. Highlights:

- **Phase 0–3**: Scaffold, header/footer, public pages (homepage, story,
  category), full SEO (sitemap, robots, JSON-LD, Google News sitemap)
- **Phase 5**: Full editor portal — auth, drafts list, all-stories table
  with sort/search/filter, create/edit forms with workflow buttons,
  delete with confirm
- **Phase 5.5–5.7**: Visual harmonization with v1 — Playfair + Source
  Sans 3 fonts, 4-corner masthead, hero carousel, Top Stories rail
- **Editor Portal extensions**: landing page with 3 tiles · Credentials
  page (multi-role w/ tier-aware hierarchy enforcement) · Site Layout
  drag-drop pin editor that the homepage actually consumes

See [`TODO.md`](./TODO.md) for what's left.

---

## Architecture north star

- **Public pages are statically rendered with ISR.** `revalidate = 60`
  on `/`, sections, and individual stories. Edge cache absorbs traffic;
  Supabase sees ~1 query per page per minute regardless of load.
- **Editor pages are dynamic.** Drafts + submitted stories aren't safe
  to cache, so portal routes skip ISR.
- **Per-page metadata** ships in the HTML head: title, description,
  canonical, og:image, twitter:card. Plus a `NewsArticle` JSON-LD blob
  + `BreadcrumbList` on every story for Google News.
- **All mutations are Server Actions.** No client-side raw-fetch
  wrappers. The Supabase auth deadlocks that v1 had to work around
  don't surface server-side.
- **Slug URLs** are `/<section>/<headline-slug>-<8charHex>`. The 8-char
  hex is the actual lookup key (first 8 chars of UUID); the slug is
  for humans + SEO. No DB schema change required to add real slugs
  later — the URL pattern is forward-compatible.

---

## Operational notes

- **Vercel runtime logs** (`vercel logs <deployment-id>` or the Vercel
  MCP) are the fastest way to diagnose a publish/save failure. Server
  actions log full PostgrestError details (`message`, `details`, `hint`,
  `code`) plus context (user id, role, intent).
- **The Vercel log table view truncates messages.** If you see `code:
  '42P...'` and can't tell which one, query for the specific code with
  the `query` filter (`42P01` = missing table, `42P17` = RLS recursion,
  `42501` = RLS denial, `23502` = NOT NULL violation, `23503` = FK
  violation).
- **Cloudinary** is intentionally NOT installed — earlier debate landed
  on "use it eventually for proper image optimization," but we're using
  paste-URL for hero photos in the interim. See `TODO.md`.

---

## License

Private — © South Shore Press.
