-- Seed example: grant edit/delete perms to daniel@test.com for client_abc

insert into public.user_permission_grants (user_id, perm, client_id)
select up.id, 'edit_all_messages', 'client_abc'
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'daniel@test.com'
on conflict do nothing;

insert into public.user_permission_grants (user_id, perm, client_id)
select up.id, 'delete_all_messages', 'client_abc'
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'daniel@test.com'
on conflict do nothing;
