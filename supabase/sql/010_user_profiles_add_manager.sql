-- ================================================
-- Add "manager" role to user_profiles
-- ================================================

-- 1) Drop the existing CHECK constraint on user_profiles.role (name may vary)
do $$
declare
  cname text;
begin
  select conname
  into cname
  from pg_constraint
  where conrelid = 'public.user_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role in (%';

  if cname is not null then
    execute format('alter table public.user_profiles drop constraint %I', cname);
  end if;
end $$;

-- 2) Add a new CHECK that includes 'manager'
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin','client','manager'));

-- (Optional) If you want managers to be the default for new internal users (usually keep 'client'):
-- alter table public.user_profiles alter column role set default 'client';
