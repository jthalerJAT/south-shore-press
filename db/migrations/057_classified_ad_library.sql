-- 057_classified_ad_library.sql (idempotent, manual-apply in the Supabase SQL editor)
--
-- Library of individual classified-ad images (publisher direction 2026-10-26):
-- the same ads run week after week, so every ad uploaded on a classifieds page
-- is remembered here and can be re-placed from a dropdown in future weeks
-- instead of re-uploading. storage_path points into the public `classifieds`
-- bucket (np-ads/ prefix, cropped PNGs).
--
-- Backfill: seeds the library from the ads currently placed on the
-- classifieds pages of BOTH issue variants - i.e. the most recent week's
-- files - so the dropdown starts populated.

create table if not exists public.classified_ad_library (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  file_name     text,
  created_at    timestamptz not null default now()
);

-- Service-role only (reads and writes go through the portal's server code).
alter table public.classified_ad_library enable row level security;

insert into public.classified_ad_library (storage_path, file_name)
select distinct a->>'storage_path', nullif(a->>'file_name', '')
from public.np_pages p,
     jsonb_array_elements(coalesce(p.template_data->'ads', '[]'::jsonb)) a
where p.kind = 'classifieds'
  and coalesce(a->>'storage_path', '') <> ''
on conflict (storage_path) do nothing;

notify pgrst, 'reload schema';

-- Verification: how many ads the dropdown starts with
select count(*) as library_ads from public.classified_ad_library;
