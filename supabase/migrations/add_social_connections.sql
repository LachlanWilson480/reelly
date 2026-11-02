-- Direct posting: one row per connected social account, plus post results and metrics.
-- Tokens are stored encrypted by the server. No client policies exist, so only the server (service role) can read them.
create table if not exists social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube','tiktok','instagram','linkedin','facebook')),
  account_id text,
  account_name text,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  unique (user_id, platform)
);
alter table social_connections enable row level security;

alter table scheduled_posts add column if not exists results jsonb not null default '{}'::jsonb;
alter table scheduled_posts add column if not exists attempts int not null default 0;

create table if not exists post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  platform text not null,
  external_id text,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  fetched_at timestamptz not null default now(),
  unique (scheduled_post_id, platform)
);
alter table post_metrics enable row level security;
drop policy if exists "read own post metrics" on post_metrics;
create policy "read own post metrics" on post_metrics for select using (auth.uid() = user_id);
