-- Permission catalog + helper (with optional RLS swaps)

-- 1) Permission catalog
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

-- 2) Grants
create table if not exists public.user_permission_grants (
  user_id uuid not null references auth.users on delete cascade,
  perm text not null references public.permission_kinds(perm) on delete cascade,
  client_id text null,
  primary key (user_id, perm, client_id)
);

-- 3) Helper: admins always pass; otherwise check grants (optionally by client)
create or replace function public.has_perm(uid uuid, p text, target_client_id text default null)
returns boolean
language sql
stable
as $$
  select
    exists (select 1 from public.user_profiles up where up.id = uid and up.role = 'admin')
    or exists (
      select 1 from public.user_permission_grants g
      where g.user_id = uid
        and g.perm = p
        and (g.client_id is null or g.client_id = coalesce(target_client_id, g.client_id))
    );
$$;

-- 4) RPC wrapper for the app
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

-- ============================================================
-- Optional RLS swaps you can add when ready
-- (keeps current owner policies intact)
-- ============================================================

-- Messages: update/delete via permissions (admin-only routes replaced)
-- drop policy if exists "Admins update messages" on public.messages;
-- drop policy if exists "Admins delete messages" on public.messages;
-- create policy "Perm: edit_all_messages can update"
-- on public.messages for update to authenticated
-- using ( public.has_perm(auth.uid(), 'edit_all_messages', messages.client_id) )
-- with check ( true );
-- create policy "Perm: delete_all_messages can delete"
-- on public.messages for delete to authenticated
-- using ( public.has_perm(auth.uid(), 'delete_all_messages', messages.client_id) );

-- Tags: insert/update/delete via permissions
-- drop policy if exists "Admins insert tags" on public.message_tags;
-- drop policy if exists "Admins update tags" on public.message_tags;
-- drop policy if exists "Admins delete tags" on public.message_tags;
-- create policy "Perm: edit_all_messages can insert tags"
-- on public.message_tags for insert to authenticated
-- with check ( public.has_perm(auth.uid(), 'edit_all_messages') );
-- create policy "Perm: edit_all_messages can update tags"
-- on public.message_tags for update to authenticated
-- using ( public.has_perm(auth.uid(), 'edit_all_messages') )
-- with check ( true );
-- create policy "Perm: delete_all_messages can delete tags"
-- on public.message_tags for delete to authenticated
-- using ( public.has_perm(auth.uid(), 'delete_all_messages') );
