-- 008_message_insert_policies.sql
-- Refined INSERT policies for messages and message_contacts
-- Drops existing versions if present, then recreates.

-- Drop old policies (ignore errors if not existing)
drop policy if exists "Admins can insert any message" on public.messages;
drop policy if exists "Clients can insert their own shared/public messages" on public.messages;
drop policy if exists "Contacts can insert their own recipient rows" on public.message_contacts;

-- Admins can insert any message
create policy "Admins can insert any message"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

-- Clients can insert their own shared/public messages
create policy "Clients can insert their own shared/public messages"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.client_id = messages.client_id
      and up.contact_id = messages.contact_id
  )
  and visibility in ('shared','public')
);

-- Contacts can insert their own recipient rows (mark-as-read)
create policy "Contacts can insert their own recipient rows"
on public.message_contacts
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = message_contacts.contact_id
  )
);
