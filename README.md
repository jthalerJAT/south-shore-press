# The South Shore Press

Online news site for Long Island's South Shore.

This is **v2** — a ground-up rebuild of the original Vite SPA at
[`jthalerJAT/southshorepress`](https://github.com/jthalerJAT/southshorepress)
to give the site the SSR, SEO, mobile responsiveness, and ad-platform
hooks a real news publication needs at scale.

## Stack

- **[Next.js 14](https://nextjs.org/)** — App Router, React Server
  Components, TypeScript. Server-rendered pages so Google News + social
  scrapers see real HTML, not a JS shell.
- **[Tailwind CSS](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** —
  utility-first, mobile-first, accessible primitives.
- **[Supabase](https://supabase.com/)** — auth, Postgres, and Storage
  (for the photo upload pipeline that replaces v1's "paste a URL" workflow).
  Same Supabase project as v1; data carries over automatically.
- **[Vercel](https://vercel.com/)** — hosting + edge cache + Image
  Optimization. ISR keeps the most-visited story pages on the CDN so
  1M views/day doesn't hammer Postgres.

## Local development

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy

- Auto-deploys on push to `main` via the Vercel project linked to this repo.
- Required env vars on the Vercel project:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Preview URL: <https://south-shore-press.vercel.app> (until production
  domain is cut over from v1).

## Architecture notes (north star)

- Public pages (homepage, story page, category page) are Server Components
  fetching from Supabase server-side and statically rendered with ISR.
- Per-page metadata is shipped in the HTML head: title, description,
  canonical, og:image, twitter:card, plus a NewsArticle JSON-LD blob per
  story so Google News indexes correctly.
- Article URLs are slug-based (e.g. `/story/lets-get-ahead-of-the-curve`);
  legacy UUID URLs from v1 redirect to the new slugs.
- Generic `<AdSlot id="..." />` placeholders are wired into the layouts so
  any ad network (GAM, Mediavine, Raptive, etc.) can drop in later
  without restructuring pages.
- All client mutations (publish, unpublish, edit, save draft) use Next.js
  Server Actions — no client-side raw-fetch wrappers needed; the
  Supabase auth bugs that v1 worked around don't surface server-side.

## Phased build status

- [x] Phase 0 — Scaffold (this commit)
- [ ] Phase 1 — Header + Footer + base layout + SEO defaults
- [ ] Phase 2 — Homepage + Story page + Category page (server-rendered)
- [ ] Phase 3 — Sign in / Create account / Forgot password / Subscribe / Email Briefings
- [ ] Phase 4 — Story Editor (journalist view + drafts + Save/Submit)
- [ ] Phase 5 — Editor Portal (Credentials + Site Layout + Edit Stories + Publish/Unpublish/Downgrade/Delete)
- [ ] Phase 6 — Hero Media (image + YouTube) + Supabase Storage upload
- [ ] Phase 7 — Ad slots + analytics + sitemap + robots
- [ ] Phase 8 — Polish + mobile QA + domain cutover
