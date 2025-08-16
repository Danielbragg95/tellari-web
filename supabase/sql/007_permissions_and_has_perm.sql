-- ================================
-- PERMISSIONS: Kinds + Grants + Helper
-- ================================

-- Catalog of permission names
create table if not exists public.permission_kinds (
  perm text primary key
);

insert into public.permission_kinds (perm)
values
  ('manage_clients'),
  ('edit_all_messages'),
  ('delete_all_messages'),
  ('manage_tasks'),
  ('manage_files')
on conflict do nothing;

-- Grants: which user has which permission (optionally scoped to a client_id)
create table if not exists public.user_permission_grants (
  user_id uuid not null references auth.users on delete cascade,
  perm text not null references public.permission_kinds(perm) on delete cascade,
  client_id text null,
  primary key (user_id, perm, client_id)
);

-- Helper function: has_perm(uid, perm, target_client_id)
-- Admins automatically get everything
-- Managers/staff get only what is granted
create or replace function public.has_perm(uid uuid, p text, target_client_id text default null)
returns boolean
language sql
stable
as $$
  select
    -- Admins get everything by default
    exists (
      select 1 from public.user_profiles up
      where up.id = uid and up.role = 'admin'
    )
    or
    -- Or permission explicitly granted
    exists (
      select 1 from public.user_permission_grants g
      where g.user_id = uid
        and g.perm = p
        and (g.client_id is null or g.client_id = coalesce(target_client_id, g.client_id))
    );
$$;

-- Optional: Debug view to inspect granted perms
create or replace view public.my_perms as
select g.*, u.email
from public.user_permission_grants g
join auth.users u on u.id = g.user_id;
