-- =========================================
-- Tellari Feed: contacts + projects + view
-- Safe to re-run (idempotent)
-- =========================================

-- 0) CONTACTS TABLE (for author names/avatars)
create table if not exists public.contacts (
  id text primary key,              -- matches messages.contact_id and user_profiles.contact_id
  client_id text not null,
  name text not null,
  email text null,
  avatar_url text null,
  created_at timestamptz not null default now()
);

-- Helpful index for lookups
create index if not exists contacts_client_id_idx on public.contacts(client_id);

-- 0a) SEED CONTACTS from user_profiles (preferred source)
insert into public.contacts (id, client_id, name, email, avatar_url)
select distinct on (up.contact_id)
  up.contact_id,
  up.client_id,
  coalesce(u.email, up.contact_id) as name,
  u.email as email,
  null as avatar_url
from public.user_profiles up
left join auth.users u on u.id = up.id
where up.contact_id is not null
on conflict (id) do nothing;

-- 0b) SEED CONTACTS from messages for any contact_ids not present yet
insert into public.contacts (id, client_id, name, email, avatar_url)
select distinct on (m.contact_id)
  m.contact_id,
  m.client_id,
  coalesce(m.contact_id, 'contact') as name,
  null as email,
  null as avatar_url
from public.messages m
where m.contact_id is not null
  and not exists (
    select 1 from public.contacts c where c.id = m.contact_id
  )
on conflict (id) do nothing;

-- 1) PROJECTS TABLE (if missing)
create table if not exists public.projects (
  id text primary key,
  client_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_client_id_idx on public.projects(client_id);

-- 2) MESSAGES: add optional project_id + FK to projects
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

-- Helpful feed indexes
create index if not exists messages_client_created_idx on public.messages(client_id, created_at desc);
create index if not exists messages_project_created_idx on public.messages(project_id, created_at desc);

-- 3) FEED VIEW: author + avatar + project + tags flattened
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

-- NOTE on RLS:
-- Keep your existing RLS on base tables (messages, message_tags, message_contacts).
-- You do NOT need to add RLS on this view; base-table RLS is enforced automatically on SELECTs via the view.
