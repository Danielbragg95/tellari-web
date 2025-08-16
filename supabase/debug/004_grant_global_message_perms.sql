-- ============================================
-- Grant global message permissions to a user
-- ============================================
-- Replace 'someone@yourcompany.com' with the actual email.
-- client_id = null → permission applies across all clients.

-- Grant edit_all_messages (global)
insert into public.user_permission_grants (user_id, perm, client_id)
select up.id, 'edit_all_messages', null
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'someone@yourcompany.com'
on conflict do nothing;

-- Grant delete_all_messages (global)
insert into public.user_permission_grants (user_id, perm, client_id)
select up.id, 'delete_all_messages', null
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'someone@yourcompany.com'
on conflict do nothing;
