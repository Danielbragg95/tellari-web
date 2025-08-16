-- 000_baseline_guardrails.sql
-- Purpose: Make any environment "safe" for the current Tellari app, without dropping data.
-- Idempotent: YES (uses IF EXISTS/IF NOT EXISTS/CREATE OR REPLACE)
-- What this does:
--  - Ensures required tables/columns exist (contacts, projects, messages.project_id)
--  - Enables RLS where required
--  - Ensures helpful indexes exist
--  - (Re)creates permission helpers: has_perm(), has_perm_rpc()
--  - (Re)creates the feed view: message_feed_v1
--  - Ensures Supabase Realtime publication includes feed tables
--  - (Optional) Permission-based RLS policies are provided but COMMENTED OUT so you can stage them

------------------------------
-- 1) Core tables & columns --
------------------------------

-- contacts
create table if not exists public.contacts (
  id text primary key,
  client_id text not null,
  name text not null,
  email text null,
  avatar_url text null,
  created_at timestamptz not null default now()
);
create index if not exists contacts_client_id_idx on public.contacts(client_id);

-- projects
create table if not exists public.projects (
  id text primary key,
  client_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists projects_client_id_idx on public.projects(client_id);

-- messages base table (must already exist from earlier migrations)
-- add project_id column safely + FK
alter table if exists public.messages
  add column if not exists project_id text;
do $$
begin
  alter table public.messages
    add constraint messages_project_id_fkey
    foreign key (project_id) references public.projects(id)
    on delete set null;
exception
  when duplicate_object then null;
end $$;

-- helpful indexes (safe to (re)create)
create index if not exists messages_client_created_idx on public.messages(client_id, created_at desc);
create index if not exists messages_project_created_idx on public.messages(project_id, created_at desc);

------------------------------------
-- 2) Row Level Security switches --
------------------------------------
-- (Make sure RLS is enabled on core tables)
alter table if exists public.messages enable row level security;
alter table if exists public.message_tags enable row level security;
alter table if exists public.message_contacts enable row level security;

------------------------------------
-- 3) Permission primitives       --
------------------------------------
create table if not exists public.permission_kinds (
  perm text primary key
);
insert into public.permission_kinds (perm) values
  ('manage_clients'),
  ('edit_all_messages'),
  ('delete_all_messages'),
  ('manage_tasks'),
  ('manage_files')
on conflict do nothing;

create table if not exists public.user_permission_grants (
  user_id uuid not null references auth.users on delete cascade,
  perm text not null references public.permission_kinds(perm) on delete cascade,
  client_id text null,
  primary key (user_id, perm, client_id)
);

create or replace function public.has_perm(uid uuid, p text, target_client_id text default null)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from public.user_profiles up
      where up.id = uid and up.role = 'admin'
    )
    or exists (
      select 1 from public.user_permission_grants g
      where g.user_id = uid
        and g.perm = p
        and (g.client_id is null or g.client_id = coalesce(target_client_id, g.client_id))
    );
$$;

create or replace function public.has_perm_rpc(p text, target_client_id text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm(auth.uid(), p, target_client_id);
$$;
grant execute on function public.has_perm_rpc(text, text) to anon, authenticated;

------------------------------------
-- 4) Feed view (enriched)       --
------------------------------------
create or replace view public.message_feed_v1 as
select
  m.id,
  m.created_at,
  m.client_id,
  m.project_id,
  p.name as project_name,
  m.contact_id,
  c.name as author_name,
  c.email as author_email,
  c.avatar_url,
  m.title,
  m.body,
  m.visibility,
  coalesce(mt.tags, array[]::text[]) as tags
from public.messages m
left join public.contacts c on c.id = m.contact_id
left join public.projects p on p.id = m.project_id
left join lateral (
  select array_agg(t.tag order by t.tag) as tags
  from public.message_tags t
  where t.message_id = m.id
) mt on true;

--------------------------------------------------
-- 5) Supabase Realtime publication (idempotent) --
--------------------------------------------------
-- These will no-op if already added.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_tags;
alter publication supabase_realtime add table public.message_contacts;

--------------------------------------------------
-- 6) (Optional) Permission-based RLS policies  --
--------------------------------------------------
-- Uncomment when ready to enforce with has_perm().
-- NOTE: Keep your author/owner policies alongside these.
/*
drop policy if exists "messages_update_perm" on public.messages;
create policy "messages_update_perm"
on public.messages for update to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages', public.messages.client_id) )
with check (true);

drop policy if exists "messages_delete_perm" on public.messages;
create policy "messages_delete_perm"
on public.messages for delete to authenticated
using ( public.has_perm(auth.uid(), 'delete_all_messages', public.messages.client_id) );

drop policy if exists "message_tags_insert_perm" on public.message_tags;
create policy "message_tags_insert_perm"
on public.message_tags for insert to authenticated
with check ( public.has_perm(auth.uid(), 'edit_all_messages') );

drop policy if exists "message_tags_update_perm" on public.message_tags;
create policy "message_tags_update_perm"
on public.message_tags for update to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages') )
with check (true);

drop policy if exists "message_tags_delete_perm" on public.message_tags;
create policy "message_tags_delete_perm"
on public.message_tags for delete to authenticated
using ( public.has_perm(auth.uid(), 'delete_all_messages') );
*/
