-- 037: Story audit trail.
--
-- Answers "who pressed publish / unpublish / delete, and when" as a database
-- fact instead of a log-forensics exercise (motivated by the 2026-07-23
-- mass-publish investigation, where identity had to be reconstructed from
-- Vercel + Supabase edge logs).
--
-- Implemented as a trigger ON THE TABLE, not in the app's server actions, so
-- EVERY path is captured: portal server actions (actor = the signed-in user's
-- auth.uid()), and any direct API/service-role/SQL write (actor = NULL, which
-- is itself the red flag — no portal user did it).
--
-- Run in Supabase Studio SQL editor.

-- ── Audit table ─────────────────────────────────────────────────────────────
create table if not exists public.story_audit (
  id           bigint generated always as identity primary key,
  story_id     uuid not null,              -- no FK: rows must survive story deletion
  headline     text,                       -- snapshot at the time of the event
  action       text not null check (action in ('created', 'status_change', 'deleted')),
  old_status   text,
  new_status   text,
  actor_id     uuid,                       -- auth.uid() of the acting user; NULL = service key / direct SQL
  actor_email  text,                       -- snapshot so history survives account deletion
  actor_name   text,
  created_at   timestamptz not null default now()
);

create index if not exists story_audit_story_idx on public.story_audit (story_id, created_at desc);
create index if not exists story_audit_created_idx on public.story_audit (created_at desc);

-- Editors and up can read the trail; nobody inserts directly (the trigger
-- function is SECURITY DEFINER and bypasses RLS). No update/delete policies:
-- the trail is append-only for everyone below the service role.
alter table public.story_audit enable row level security;

drop policy if exists "story_audit_read_editorial" on public.story_audit;
create policy "story_audit_read_editorial" on public.story_audit
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          -- role is an enum whose spelling varies by environment
          -- ('master_admin' vs 'master admin') — compare as normalized text,
          -- same pattern as migrations 006/016/036.
          replace(lower(p.role::text), '_', ' ') in ('editor', 'admin', 'master admin')
          or p.roles && array['editor', 'admin', 'master admin']::text[]
        )
    )
  );

-- ── Convenience columns on stories ──────────────────────────────────────────
-- Stamped by the trigger on every draft/submitted/unpublished → published
-- transition, so "published by" is one column away in any story query.
alter table public.stories add column if not exists published_by uuid;
alter table public.stories add column if not exists published_by_name text;

-- ── Trigger ─────────────────────────────────────────────────────────────────
create or replace function public.log_story_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_name  text;
begin
  if v_actor is not null then
    select email, display_name into v_email, v_name
    from public.profiles where id = v_actor;
  end if;

  if tg_op = 'INSERT' then
    insert into story_audit (story_id, headline, action, old_status, new_status, actor_id, actor_email, actor_name)
    values (new.id, new.headline, 'created', null, new.status, v_actor, v_email, v_name);
    if new.status = 'published' then
      new.published_by := v_actor;
      new.published_by_name := coalesce(v_name, v_email);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into story_audit (story_id, headline, action, old_status, new_status, actor_id, actor_email, actor_name)
      values (new.id, new.headline, 'status_change', old.status, new.status, v_actor, v_email, v_name);
      if new.status = 'published' then
        new.published_by := v_actor;
        new.published_by_name := coalesce(v_name, v_email);
      end if;
    end if;
    return new;
  end if;

  -- DELETE
  insert into story_audit (story_id, headline, action, old_status, new_status, actor_id, actor_email, actor_name)
  values (old.id, old.headline, 'deleted', old.status, null, v_actor, v_email, v_name);
  return old;
end;
$$;

drop trigger if exists story_audit_trigger on public.stories;
create trigger story_audit_trigger
  before insert or update or delete on public.stories
  for each row execute function public.log_story_audit();
