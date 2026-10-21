-- 053_affidavit_required.sql (idempotent, manual-apply in the Supabase SQL editor)
--
-- Split affidavit tracking into two flags (rate card adopted 2026-10-21):
--   affidavit_required       affidavit of publication needed — scanned PDF
--                            emailed (free for public bodies, covered by the
--                            $25 fee for market-tier clients)
--   notary_required (existing) physical notarized copy to be mailed (+$10,
--                            any client)

alter table public.customer_legals
  add column if not exists affidavit_required boolean not null default false;

-- Anyone who wanted a mailed notarized copy clearly needs the affidavit.
update public.customer_legals set affidavit_required = true where notary_required;
