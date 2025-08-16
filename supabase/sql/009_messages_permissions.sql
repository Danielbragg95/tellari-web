-- 012_messages_permissions.sql
-- Purpose: apply fine‑grained permissions using has_perm() to messages, tags, and message_contacts
-- Prereqs: 010_permissions_and_has_perm.sql, 011_has_perm_rpc.sql

-- ================================
-- MESSAGES: UPDATE / DELETE via permissions
-- ================================
drop policy if exists "Admins update messages" on public.messages;
drop policy if exists "Admins delete messages" on public.messages;

create policy "Users with 'edit_all_messages' can update"
on public.messages for update to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages', messages.client_id) )
with check (true);

create policy "Users with 'delete_all_messages' can delete"
on public.messages for delete to authenticated
using ( public.has_perm(auth.uid(), 'delete_all_messages', messages.client_id) );

-- Keep your “Clients update/delete own messages” policies (already created) – do not remove them.

-- ================================
-- MESSAGE_TAGS: write actions via permissions (previously admin-only)
-- ================================
drop policy if exists "Admins insert tags" on public.message_tags;
drop policy if exists "Admins update tags" on public.message_tags;
drop policy if exists "Admins delete tags" on public.message_tags;

create policy "Users with 'edit_all_messages' can insert tags"
on public.message_tags for insert to authenticated
with check ( public.has_perm(auth.uid(), 'edit_all_messages') );

create policy "Users with 'edit_all_messages' can update tags"
on public.message_tags for update to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages') )
with check (true);

create policy "Users with 'delete_all_messages' can delete tags"
on public.message_tags for delete to authenticated
using ( public.has_perm(auth.uid(), 'delete_all_messages') );

-- ================================
-- MESSAGE_CONTACTS: cleanup via permission (optional)
-- ================================
drop policy if exists "Admins manage message_contacts" on public.message_contacts;

create policy "Users with 'edit_all_messages' can cleanup message_contacts"
on public.message_contacts for delete to authenticated
using ( public.has_perm(auth.uid(), 'edit_all_messages') );
