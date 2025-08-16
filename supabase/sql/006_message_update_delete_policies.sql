-- 009_message_update_delete_policies.sql
-- ================================
-- MESSAGES: UPDATE / DELETE
-- ================================
drop policy if exists "Admins update messages" on public.messages;
drop policy if exists "Admins delete messages" on public.messages;
drop policy if exists "Clients update own messages" on public.messages;
drop policy if exists "Clients delete own messages" on public.messages;

-- Admins can UPDATE any message
create policy "Admins update messages"
on public.messages
for update
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'admin')
)
with check (true);

-- Admins can DELETE any message
create policy "Admins delete messages"
on public.messages
for delete
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'admin')
);

-- Clients can UPDATE messages they authored (same client + same sender contact)
create policy "Clients update own messages"
on public.messages
for update
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid()
            and up.client_id = messages.client_id
            and up.contact_id = messages.contact_id)
)
with check (true);

-- Clients can DELETE messages they authored (same client + same sender contact)
create policy "Clients delete own messages"
on public.messages
for delete
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid()
            and up.client_id = messages.client_id
            and up.contact_id = messages.contact_id)
);

-- ================================
-- MESSAGE_TAGS: INSERT / UPDATE / DELETE (admins only for write)
-- ================================
drop policy if exists "Admins insert tags" on public.message_tags;
drop policy if exists "Admins update tags" on public.message_tags;
drop policy if exists "Admins delete tags" on public.message_tags;

-- Admins can INSERT tags
create policy "Admins insert tags"
on public.message_tags
for insert
to authenticated
with check (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'admin')
);

-- Admins can UPDATE tags
create policy "Admins update tags"
on public.message_tags
for update
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'admin')
)
with check (true);

-- Admins can DELETE tags
create policy "Admins delete tags"
on public.message_tags
for delete
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'admin')
);

-- ================================
-- MESSAGE_CONTACTS: INSERT (self), UPDATE read_at (self), DELETE (admin)
-- ================================
drop policy if exists "Contacts can insert their own recipient rows" on public.message_contacts;
drop policy if exists "Contacts can mark their reads" on public.message_contacts;
drop policy if exists "Admins manage message_contacts" on public.message_contacts;

-- Allow a user to INSERT their own recipient row (for first "Mark as read")
create policy "Contacts can insert their own recipient rows"
on public.message_contacts
for insert
to authenticated
with check (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid()
            and up.contact_id = message_contacts.contact_id)
);

-- Allow a user to UPDATE their own recipient row (set read_at)
create policy "Contacts can mark their reads"
on public.message_contacts
for update
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid()
            and up.contact_id = message_contacts.contact_id)
)
with check (true);

-- Admins can clean up recipient rows (optional but handy)
create policy "Admins manage message_contacts"
on public.message_contacts
for delete
to authenticated
using (
  exists (select 1 from public.user_profiles up
          where up.id = auth.uid() and up.role = 'admin')
);
