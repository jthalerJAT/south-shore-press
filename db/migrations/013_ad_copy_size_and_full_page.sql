-- 013_ad_copy_size_and_full_page.sql
-- (1) Ad "Copy Size" — the size an ad's creative is designed for; drives how it
--     renders when placed on a page (full / half / one-third / quarter).
-- (2) Page 3 becomes a full-page-ad template page (kind = 'full_page_ad', a
--     template-mode page whose ad lives in np_pages.template_data — no np_items).
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–012).

-- (1) Copy Size on the advertiser's copy.
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS copy_size text;   -- 'full' | 'half' | 'third' | 'quarter'

-- (2) Convert the seeded generic "Page 3" of the current issue into a full-page
--     ad. Safe + targeted: only the untouched seeded generic Page 3 (added
--     pages are titled "Page", not "Page 3"). Re-running is a no-op once kind
--     has changed. New issues get this from DEFAULT_PAGES directly.
UPDATE public.np_pages
   SET kind = 'full_page_ad'
 WHERE kind = 'generic'
   AND title = 'Page 3';

-- np_pages.kind is free text (no CHECK constraint), so no enum change needed.
-- RLS is unchanged: existing np_pages/ads policies cover the new column + kind.
