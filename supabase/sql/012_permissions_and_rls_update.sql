-- ============================================
-- PERMISSIONS + RLS UPDATE (roll-up migration)
-- ============================================

-- ====== PERMISSIONS PRIMITIVES ======

-- 1) Catalog of permission names (idempotent)
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

-- 2) Grants: who has which permission, optionally scoped by client_id
create table if not exists public.user_permission_grants (
  user_id uuid not null references auth.users on delete cascade,
  perm text not null references public.permission_kinds(perm) on delete cascade,
  client_id text null,
  primary key (user_id, perm, client_id)
);

-- 3) Helper: 'admin' users implicitly have all perms; otherwise check explicit grants
create or replace function public.has_perm(uid uuid, p text, target_client_id text default null)
returns boolean
language sql
stable
as $$
  select
    -- admins get everything by default
    exists (
      select 1 from public.user_profiles up
      where up.id = uid and up.role = 'admin'
    )
    or
    -- OR permission explicitly granted (optionally scoped to client)
    exists (
      select 1 from public.user_permission_grants g
      where g.user_id = uid
        and g.perm = p
        and (g.client_id is null or g.client_id = coalesce(target_client_id, g.client_id))
    );
$$;

-- 4) RPC wrapper so the app can call has_perm() easily
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

-- ====== RLS UPDATES (admin-only paths -> permission-based) ======

-- messages: UPDATE / DELETE require edit/delete perms (owner policies stay untouched)
drop policy if exists "Admins update messages" on public.messages;
drop policy if exists "Admins delete messages" on public.messages;

create policy "Perm: edit_all_messages can update"
on public.messages for update to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages', messages.client_id) )
with check ( true );

create policy "Perm: delete_all_messages can delete"
on public.messages for delete to authenticated
using ( public.has_perm(auth.uid(), 'delete_all_messages', messages.client_id) );

-- message_tags: insert/update/delete require edit/delete perms
drop policy if exists "Admins insert tags" on public.message_tags;
drop policy if exists "Admins update tags" on public.message_tags;
drop policy if exists "Admins delete tags" on public.message_tags;

create policy "Perm: edit_all_messages can insert tags"
on public.message_tags for insert to authenticated
with check ( public.has_perm(auth.uid(), 'edit_all_messages') );

create policy "Perm: edit_all_messages can update tags"
on public.message_tags for update to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages') )
with check ( true );

create policy "Perm: delete_all_messages can delete tags"
on public.message_tags for delete to authenticated
using ( public.has_perm(auth.uid(), 'delete_all_messages') );

-- message_contacts: allow privileged cleanup (optional)
drop policy if exists "Admins manage message_contacts" on public.message_contacts;

create policy "Perm: edit_all_messages can cleanup message_contacts"
on public.message_contacts for delete to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages') );
