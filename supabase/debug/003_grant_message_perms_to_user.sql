-- ============================================
-- Grant message permissions to a specific user
-- ============================================
-- Replace 'someone@yourcompany.com' and 'client_abc'
-- with the actual email and client_id.

-- Grant edit_all_messages
insert into public.user_permission_grants (user_id, perm, client_id)
select up.id, 'edit_all_messages', 'client_abc'
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'someone@yourcompany.com'
on conflict do nothing;

-- Grant delete_all_messages
insert into public.user_permission_grants (user_id, perm, client_id)
select up.id, 'delete_all_messages', 'client_abc'
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'someone@yourcompany.com'
on conflict do nothing;
