-- ================================================
-- Reset user_profiles.role CHECK constraint
-- (explicitly re-creates it with admin, manager, client)
-- ================================================

-- Drop the existing role check constraint
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Recreate it with the new role set
ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_role_check
CHECK (role IN ('admin', 'manager', 'client'));
