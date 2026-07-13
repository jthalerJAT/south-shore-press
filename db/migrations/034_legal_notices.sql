-- 034_legal_notices.sql (idempotent, manual-apply in the Supabase SQL editor)
--
-- The Legal Notices DATABASE: typed legal-notice copy (e.g. LLC formation
-- notices), reusable across issues — NY publication notices run six
-- consecutive weeks, so the weekly Legal Notices page re-picks saved copy.
-- The newspaper page itself stores which notices it placed in
-- np_pages.template_data; this table is the durable library.

create table if not exists public.legal_notices (
  id          uuid primary key default gen_random_uuid(),
  -- First line of the notice ("NOTICE OF FORMATION") — shown in pickers.
  label       text not null default 'PUBLIC NOTICE',
  body        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create index if not exists idx_legal_notices_created on public.legal_notices (created_at desc);

alter table public.legal_notices enable row level security;

-- Editor tier manages notices (helper from migration 006).
drop policy if exists "editors manage legal_notices" on public.legal_notices;
create policy "editors manage legal_notices" on public.legal_notices
  for all
  using (public.is_editor_tier(auth.uid()))
  with check (public.is_editor_tier(auth.uid()));
