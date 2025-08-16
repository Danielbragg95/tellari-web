-- 003_message_policies.sql
-- Message policies (merged insert, read, tag, recipient policies)

-- Admins can insert any message
create policy if not exists "Admins can insert any message"
on public.messages for insert to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

-- Clients can insert their own shared/public messages
create policy if not exists "Clients can insert their own shared/public messages"
on public.messages for insert to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.client_id = messages.client_id
      and up.contact_id = messages.contact_id
  )
  and visibility in ('shared','public')
);

-- READ policies for tags/recipients
create policy if not exists "Admins read all tags"
on public.message_tags for select to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

create policy if not exists "Clients read tags for their visible messages"
on public.message_tags for select to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.client_id = (select m.client_id from public.messages m where m.id = message_id)
  )
);

create policy if not exists "Admins read all message_contacts"
on public.message_contacts for select to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

create policy if not exists "Clients read their own recipient rows"
on public.message_contacts for select to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = message_contacts.contact_id
  )
);

-- INSERT tag rows (admins)
create policy if not exists "Admins can tag any message"
on public.message_tags for insert to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

-- UPDATE read status for the viewing contact
create policy if not exists "Contacts can mark their reads"
on public.message_contacts for update to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = message_contacts.contact_id
  )
)
with check (true);

-- Allow a user to INSERT a recipient row for themselves
create policy if not exists "Contacts can insert their own recipient rows"
on public.message_contacts for insert to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = message_contacts.contact_id
  )
);
