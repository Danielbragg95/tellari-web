-- ================================
-- HAS_PERM RPC WRAPPER
-- ================================

-- Expose has_perm() to clients through an RPC
-- This lets the app call supabase.rpc('has_perm_rpc', { p: 'edit_all_messages', target_client_id: 'xyz' })
-- and automatically checks permissions for the logged-in user.

create or replace function public.has_perm_rpc(p text, target_client_id text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm(auth.uid(), p, target_client_id);
$$;

-- Allow both anon and authenticated roles to call this RPC
grant execute on function public.has_perm_rpc(text, text) to anon, authenticated;
