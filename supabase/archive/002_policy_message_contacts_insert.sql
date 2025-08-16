-- 005_policy_message_contacts_insert.sql
-- Purpose: Allow a user to INSERT a recipient row for themselves in public.message_contacts
-- Date: 2025-08-15
-- Notes: Idempotent via DROP POLICY IF EXISTS

drop policy if exists "Contacts can insert their own recipient rows" on public.message_contacts;
create policy "Contacts can insert their own recipient rows"
on public.message_contacts for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.contact_id = public.message_contacts.contact_id
  )
);
