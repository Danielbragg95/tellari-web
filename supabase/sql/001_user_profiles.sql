-- 001_user_profiles.sql
-- Migration: Create user_profiles table linked to auth.users
-- Date: 2025-08-15
-- Description:
--   - Extends auth.users with profile data
--   - Adds contact_id, client_id, and role
--   - Enables Row Level Security (RLS)
--   - Policy allows users to read their own profile only

-- Create a table to extend the auth.users table
create table public.user_profiles (
  id uuid primary key references auth.users on delete cascade,
  contact_id text not null,
  client_id text not null,
  role text check (role in ('admin', 'client')) not null
);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- Policy: user can read their own profile
create policy "Users can access their own profile" on public.user_profiles
  for select using (auth.uid() = id);
