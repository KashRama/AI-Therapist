-- Add user_id to chats, linking each chat to a Supabase auth user
alter table public.chats
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Index for fast per-user chat lookups
create index if not exists chats_user_id_idx on public.chats(user_id);

-- Drop the old open-access policies
drop policy if exists "Allow all on chats" on public.chats;
drop policy if exists "Allow all on messages" on public.messages;

-- Chats: users can only see and modify their own chats
create policy "Users can read own chats"
  on public.chats for select
  using (auth.uid() = user_id);

create policy "Users can insert own chats"
  on public.chats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chats"
  on public.chats for update
  using (auth.uid() = user_id);

create policy "Users can delete own chats"
  on public.chats for delete
  using (auth.uid() = user_id);

-- Messages: accessible if the parent chat belongs to the user
create policy "Users can read own messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );

create policy "Users can insert own messages"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );
