-- 003_seed_messages.sql
-- Seed sample messages, tags, and read-status using real IDs from your DB (idempotent)
-- Date: 2025-08-15
-- Notes:
--   - Picks existing client/contact IDs from public.user_profiles
--   - Inserts three demo messages only if they don't already exist (based on unique titles)
--   - Adds tags and read-status rows conditionally

-- Helper CTEs to pick real contacts from user_profiles
with
  c1 as (
    select up.client_id, up.contact_id
    from public.user_profiles up
    where up.contact_id is not null
    limit 1
  ),
  c2 as (
    select up.client_id, up.contact_id
    from public.user_profiles up
    where up.contact_id is not null
      and (up.client_id, up.contact_id) not in (select client_id, contact_id from c1)
    limit 1
  ),
  c3 as (
    -- Prefer a different client if available; otherwise reuse c1's client/contact
    select up.client_id, up.contact_id
    from public.user_profiles up
    where up.contact_id is not null
      and up.client_id <> (select client_id from c1)
    limit 1
  ),
  chosen as (
    select
      (select client_id from c1) as client1,
      (select contact_id from c1) as contact1,
      coalesce((select client_id from c2), (select client_id from c1)) as client2,
      coalesce((select contact_id from c2), (select contact_id from c1)) as contact2,
      coalesce((select client_id from c3), (select client_id from c1)) as client3,
      coalesce((select contact_id from c3), (select contact_id from c1)) as contact3
  )

-- 1) Messages (insert if not already present by title)
insert into public.messages (client_id, contact_id, title, body, visibility)
select client1, contact1, 'Project Kickoff', 'We are starting the project today.', 'shared'
from chosen
where not exists (select 1 from public.messages where title = 'Project Kickoff');

insert into public.messages (client_id, contact_id, title, body, visibility)
select client2, contact2, 'Internal Planning', 'This is an internal-only update.', 'internal'
from chosen
where not exists (select 1 from public.messages where title = 'Internal Planning');

insert into public.messages (client_id, contact_id, title, body, visibility)
select client3, contact3, 'Q3 Review', 'Here are the results from the last quarter.', 'public'
from chosen
where not exists (select 1 from public.messages where title = 'Q3 Review');

-- 2) Tags for first message (only if not already present)
insert into public.message_tags (message_id, tag)
select m.id, 'kickoff'
from public.messages m
where m.title = 'Project Kickoff'
  and not exists (
    select 1 from public.message_tags t where t.message_id = m.id and t.tag = 'kickoff'
  );

insert into public.message_tags (message_id, tag)
select m.id, 'priority'
from public.messages m
where m.title = 'Project Kickoff'
  and not exists (
    select 1 from public.message_tags t where t.message_id = m.id and t.tag = 'priority'
  );

-- 3) Read-status recipients (choose different contacts when possible)
with
  base as (
    select m.id as message_id from public.messages m where m.title = 'Project Kickoff' limit 1
  ),
  reader1 as (
    select up.contact_id
    from public.user_profiles up
    where up.contact_id is not null
    limit 1
  ),
  reader2 as (
    select up.contact_id
    from public.user_profiles up
    where up.contact_id is not null
      and up.contact_id <> (select contact_id from reader1)
    limit 1
  )
insert into public.message_contacts (message_id, contact_id, read_at)
select (select message_id from base), (select contact_id from reader1), null
where exists (select 1 from base)
  and not exists (
    select 1 from public.message_contacts mc
    where mc.message_id = (select message_id from base)
      and mc.contact_id = (select contact_id from reader1)
  );

insert into public.message_contacts (message_id, contact_id, read_at)
select (select message_id from base), (select contact_id from reader2), now()
where exists (select 1 from base)
  and (select contact_id from reader2) is not null
  and not exists (
    select 1 from public.message_contacts mc
    where mc.message_id = (select message_id from base)
      and mc.contact_id = (select contact_id from reader2)
  );
