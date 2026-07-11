# South Shore Press v2 — Go-Live Runbook

Pointing **www.southshorepress.com** at the v2 (Vercel) site. Old content/URLs
are intentionally abandoned (no redirects). Do the pre-flight (Part A) **before**
touching DNS, then run Part B in order.

---

## Part A — Pre-flight (verify before cutover)

### A1. All database migrations applied in Supabase
Run each `db/migrations/0XX_*.sql` in the Supabase SQL editor (all are
`IF NOT EXISTS`-safe to re-run). The recent ones and what breaks if missing:

| # | Gates |
|---|---|
| 013 | ad copy-size + full-page ad |
| 014 | Owned Images library |
| 015 | `journalist` enum value — saving journalist credentials |
| 016 | journalists can create/edit their own stories (RLS) |
| 017 | story **photo caption/credit** — *saving ANY story breaks without it* |
| 018 | Classifieds |
| 019 | Constant Contact token store (Email Briefings) |
| 020 | **site search** (`fts` column + index) |
| 021 | ad-level Insert Order |

001–012 predate this stream and are already applied (auth, subscriptions,
legals, newspaper, ads all work).

### A2. Supabase Storage buckets exist (Public)
- `legals`
- `newspaper-ads`
- `newspaper-images`
- `classifieds`

### A3. Production env vars set in Vercel (Settings → Environment Variables → **Production**)
Core (required): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (set in B3).
Payments (Stripe **live**): `STRIPE_SECRET_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and the price IDs
(`STRIPE_PRICE_*`).
Email briefings (Constant Contact): `CONSTANT_CONTACT_CLIENT_ID` / `_SECRET` /
`_LIST_ID` — and the OAuth connect completed (Editor Portal → Email Briefings = Connected).
Print distribution (SimpleCirc): `SIMPLECIRC_API_TOKEN` / `_PUBLICATION_ID` /
`_POSTAGE_ID` — test passed.
Legals email (Resend): `RESEND_API_KEY`, `LEGALS_FROM_EMAIL`, `LEGALS_NOTIFY_EMAIL`.
Optional: `PRINT_API_TOKEN` (press-PDF export; guards `/print/issue`), `TWITTER_*` (social publishing).

### A4. Content ready
- Homepage hero pinned (5) in Site Layout; sections populated.
- Any cherry-picked archive articles published with the **Backdate** control.

---

## Part B — The cutover (in order)

### B1. Add the domain in Vercel
Project → **Settings → Domains → Add** `www.southshorepress.com`. Also add the
apex `southshorepress.com` and set it to **redirect to www** (www = canonical).
Vercel shows the DNS records to create.

### B2. Update DNS at the registrar (the moment of cutover)
At wherever southshorepress.com DNS is managed today, add Vercel's records — typically:
- `www` → **CNAME** → `cname.vercel-dns.com`
- apex `southshorepress.com` → **A** → `76.76.21.21` (or ALIAS/ANAME if supported)

Wait for propagation (minutes → up to ~48h). Vercel auto-issues SSL once verified.
The `*.vercel.app` URL keeps working in parallel.

### B3. Point the site at the real domain
1. Vercel env (Production): set `NEXT_PUBLIC_SITE_URL = https://www.southshorepress.com`.
2. **Redeploy** (env changes need a new build). This updates canonical URLs,
   sitemaps, robots, OG tags, and the auth/CC redirect targets in one shot.

### B4. Supabase Auth URL config (do this BEFORE/with B3)
Supabase → **Authentication → URL Configuration**:
- **Site URL** → `https://www.southshorepress.com`
- **Redirect URLs** → add `https://www.southshorepress.com/auth/callback`
  (keep the existing `*.vercel.app` one too). Without this, password-reset and
  email-confirmation links are rejected.

### B5. Constant Contact redirect URI
In the CC developer app, add the redirect URI
`https://www.southshorepress.com/api/constant-contact/callback`. (The current
connection keeps working via token refresh; this only matters for a future Reconnect.)

> Stripe webhook: no change needed — it's registered on the `*.vercel.app` URL,
> which keeps resolving. (Optionally add a webhook on the new domain later.)

---

## Part C — Post-cutover smoke test (on the real domain)
- Homepage + an article load; hero shows the pinned 5.
- **Signup → email-confirm link → signin** works.
- **Password reset** email link works.
- **Search** returns results.
- **Subscribe** (one real low-value plan, refundable) → check: Stripe charge,
  `subscription_orders` row, and the subscriber appears in **SimpleCirc**.
- **Email-briefing signup** → lands on the Constant Contact list.
- `/sitemap.xml`, `/news-sitemap.xml`, `/robots.txt` show the new domain.

## Part D — SEO follow-through (right after)
- **Google Search Console**: verify the domain; submit `sitemap.xml` + `news-sitemap.xml`.
- **Google Publisher Center / News**: submit the site.

## Rollback
If something's wrong, point the DNS records back to the old host (subject to
propagation delay). The DB is shared and untouched, so no data risk.
