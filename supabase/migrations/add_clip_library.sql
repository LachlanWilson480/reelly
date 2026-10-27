-- Clip library: clips a person uploads once and can reuse in any video.
-- The files themselves live in the existing video-uploads bucket under <user id>/library/.
create table if not exists clip_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null,
  size_bytes bigint not null default 0,
  mime text,
  duration numeric,
  created_at timestamptz not null default now()
);

create index if not exists clip_library_user_idx on clip_library (user_id, created_at desc);

alter table clip_library enable row level security;

drop policy if exists "read own library clips" on clip_library;
create policy "read own library clips" on clip_library for select using (auth.uid() = user_id);

drop policy if exists "add own library clips" on clip_library;
create policy "add own library clips" on clip_library for insert with check (auth.uid() = user_id);

drop policy if exists "change own library clips" on clip_library;
create policy "change own library clips" on clip_library for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own library clips" on clip_library;
create policy "delete own library clips" on clip_library for delete using (auth.uid() = user_id);
