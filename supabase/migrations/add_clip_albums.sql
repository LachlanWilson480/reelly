-- Albums for the clip library: group saved clips (for example "Menu items" or "Shop shots").
create table if not exists clip_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists clip_albums_user_idx on clip_albums (user_id, created_at);

-- Deleting an album keeps its clips; they go back to "No album"
alter table clip_library add column if not exists album_id uuid references clip_albums(id) on delete set null;

alter table clip_albums enable row level security;

drop policy if exists "read own albums" on clip_albums;
create policy "read own albums" on clip_albums for select using (auth.uid() = user_id);

drop policy if exists "add own albums" on clip_albums;
create policy "add own albums" on clip_albums for insert with check (auth.uid() = user_id);

drop policy if exists "change own albums" on clip_albums;
create policy "change own albums" on clip_albums for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own albums" on clip_albums;
create policy "delete own albums" on clip_albums for delete using (auth.uid() = user_id);
