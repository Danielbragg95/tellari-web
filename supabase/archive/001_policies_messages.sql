-- 004_policies_messages.sql
-- Purpose: Insert/update/select policies for messages, message_tags, and message_contacts
-- Date: 2025-08-15
-- Notes:
--   - Uses DROP POLICY IF EXISTS to stay idempotent
--   - Assumes RLS is already enabled on these tables (see 002_messages.sql)

-- ========== public.messages INSERT policies ==========

drop policy if exists "Admins can insert any message" on public.messages;
create policy "Admins can insert any message"
on public.messages for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

drop policy if exists "Clients can insert their own shared/public messages" on public.messages;
create policy "Clients can insert their own shared/public messages"
on public.messages for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.client_id = public.messages.client_id
  )
  and public.messages.visibility in ('shared','public')
);

-- ========== public.message_tags SELECT/INSERT policies ==========

drop policy if exists "Admins read all tags" on public.message_tags;
create policy "Admins read all tags"
on public.message_tags for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

drop policy if exists "Clients read tags for their visible messages" on public.message_tags;
create policy "Clients read tags for their visible messages"
on public.message_tags for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.client_id = (select m.client_id from public.messages m where m.id = public.message_tags.message_id)
  )
);

drop policy if exists "Admins can tag any message" on public.message_tags;
create policy "Admins can tag any message"
on public.message_tags for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

-- ========== public.message_contacts SELECT/UPDATE policies ==========

drop policy if exists "Admins read all message_contacts" on public.message_contacts;
create policy "Admins read all message_contacts"
on public.message_contacts for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

drop policy if exists "Clients read their own recipient rows" on public.message_contacts;
create policy "Clients read their own recipient rows"
on public.message_contacts for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = public.message_contacts.contact_id
  )
);

drop policy if exists "Contacts can mark their reads" on public.message_contacts;
create policy "Contacts can mark their reads"
on public.message_contacts for update
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = public.message_contacts.contact_id
  )
)
with check (true);
