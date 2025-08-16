-- z99_sanity_checks.sql
-- Purpose: Quick report of required objects for Tellari app.
-- Run this any time to verify an environment is aligned with the app.

-- 1) Tables present?
select 'tables' as kind, t as name, 
       case when exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then '✅' else '❌' end as ok
from (values
  ('user_profiles'),
  ('messages'),
  ('message_tags'),
  ('message_contacts'),
  ('contacts'),
  ('projects'),
  ('permission_kinds'),
  ('user_permission_grants')
) as v(t)
order by t;

-- 2) Critical columns present?
select 'columns' as kind, tbl||'.'||col as name,
       case when exists (
         select 1 from information_schema.columns 
         where table_schema='public' and table_name=tbl and column_name=col
       ) then '✅' else '❌' end as ok
from (values
  ('user_profiles','id'),
  ('user_profiles','client_id'),
  ('user_profiles','contact_id'),
  ('user_profiles','role'),
  ('messages','id'),
  ('messages','client_id'),
  ('messages','contact_id'),
  ('messages','project_id'),
  ('messages','body'),
  ('messages','visibility'),
  ('messages','created_at'),
  ('message_tags','message_id'),
  ('message_tags','tag'),
  ('message_contacts','message_id'),
  ('message_contacts','contact_id'),
  ('contacts','id'),
  ('contacts','client_id'),
  ('contacts','name'),
  ('projects','id'),
  ('projects','client_id'),
  ('projects','name')
) as c(tbl,col)
order by tbl, col;

-- 3) Functions present?
select 'functions' as kind, name, 
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname=name) then '✅' else '❌' end as ok
from (values
  ('has_perm'),
  ('has_perm_rpc')
) as f(name)
order by name;

-- 4) View present?
select 'views' as kind, name,
       case when exists (select 1 from information_schema.views 
                         where table_schema='public' and table_name=name) then '✅' else '❌' end as ok
from (values
  ('message_feed_v1')
) as v(name);

-- 5) RLS enabled on core tables?
select 'rls_enabled' as kind, t as table_name,
       case when relrowsecurity then '✅' else '❌' end as ok
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join (values ('messages'), ('message_tags'), ('message_contacts')) as req(t) on req.t = c.relname
where n.nspname='public'
order by t;

-- 6) Optional: show any missing items for quick copy/paste
-- (Rows marked ❌ above indicate what to fix.)
