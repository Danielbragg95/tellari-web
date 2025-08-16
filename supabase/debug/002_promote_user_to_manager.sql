-- ============================================
-- Promote a specific user to 'manager'
-- ============================================

-- Replace 'someone@yourcompany.com' with the actual email you want to promote
update public.user_profiles
set role = 'manager'
where id = (
  select id from auth.users
  where email = 'someone@yourcompany.com'
);
