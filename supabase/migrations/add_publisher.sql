-- Publisher: the social pages each business posts to, and the table of scheduled posts.
alter table business_profiles add column if not exists social_profiles jsonb not null default '{}'::jsonb;

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_id text,
  title text not null,
  caption text,
  tags text,
  video_url text,
  scheduled_for timestamptz not null,
  platforms text[] not null default '{}',
  status text not null default 'scheduled',
  posted_at timestamptz,
  error_text text,
  created_at timestamptz not null default now()
);
alter table scheduled_posts add column if not exists error_text text;
alter table scheduled_posts add column if not exists posted_at timestamptz;
create index if not exists scheduled_posts_due_idx on scheduled_posts (status, scheduled_for);
alter table scheduled_posts enable row level security;
drop policy if exists "read own scheduled posts" on scheduled_posts;
create policy "read own scheduled posts" on scheduled_posts for select using (auth.uid() = user_id);
