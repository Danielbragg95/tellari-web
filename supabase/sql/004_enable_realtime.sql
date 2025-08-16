-- Ensure realtime is on for these tables
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_tags;
alter publication supabase_realtime add table public.message_contacts;
