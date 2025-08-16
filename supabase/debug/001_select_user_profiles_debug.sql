select up.id, up.client_id, up.contact_id, up.role, u.email
from public.user_profiles up
join auth.users u on u.id = up.id
where u.email = 'daniel@test.com';
