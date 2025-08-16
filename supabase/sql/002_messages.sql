-- 002_messages.sql

-- 1. Main messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  contact_id text, -- sender contact (optional if system-generated)
  title text, -- optional subject line
  body text not null,
  visibility text not null default 'shared'
    check (visibility in ('internal', 'shared', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at on any edit
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.messages;
create trigger set_updated_at
before update on public.messages
for each row
execute function update_updated_at_column();

-- 2. Tags for messages
create table if not exists public.message_tags (
  message_id uuid references public.messages on delete cascade,
  tag text not null,
  primary key (message_id, tag)
);

-- 3. Recipients (contact-level targeting + read status)
create table if not exists public.message_contacts (
  message_id uuid references public.messages on delete cascade,
  contact_id text not null,
  read_at timestamptz,
  primary key (message_id, contact_id)
);

-- Optional: 4. Multi-client targeting (only if a message can belong to more than one client)
create table if not exists public.message_clients (
  message_id uuid references public.messages on delete cascade,
  client_id text not null,
  primary key (message_id, client_id)
);

-- 5. Row Level Security
alter table public.messages enable row level security;
alter table public.message_tags enable row level security;
alter table public.message_contacts enable row level security;
alter table public.message_clients enable row level security;

-- Admins see all messages
drop policy if exists "Admins see all messages" on public.messages;
create policy "Admins see all messages"
on public.messages for select
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role = 'admin'
  )
);

-- Clients see only their shared/public messages
drop policy if exists "Clients see shared/public messages" on public.messages;
create policy "Clients see shared/public messages"
on public.messages for select
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.client_id = messages.client_id
  )
  and visibility in ('shared', 'public')
);
