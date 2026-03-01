-- Chats table: stores chat sessions
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages table: stores individual messages within a chat
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Index for efficient message lookups by chat
create index if not exists messages_chat_id_idx on public.messages(chat_id);
create index if not exists chats_updated_at_idx on public.chats(updated_at desc);

-- Enable RLS (Row Level Security) - allow all for now; add auth later
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- Policies: allow all operations for anonymous users (adjust when adding auth)
create policy "Allow all on chats" on public.chats for all using (true) with check (true);
create policy "Allow all on messages" on public.messages for all using (true) with check (true);
