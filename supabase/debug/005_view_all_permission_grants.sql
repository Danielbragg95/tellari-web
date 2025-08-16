-- ============================================================
-- Debug helper: inspect all user permission grants with emails
-- ============================================================

-- Ensure view exists and is up to date
create or replace view public.my_perms as
select g.*, u.email
from public.user_permission_grants g
join auth.users u on u.id = g.user_id;

-- See all grants in a friendly order
select * 
from public.my_perms
order by email, perm, client_id;
