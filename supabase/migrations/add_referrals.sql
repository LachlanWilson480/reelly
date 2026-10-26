-- Refer a friend: each user gets a code, and each friend who joins with it is tracked until they pay.
create table if not exists referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  status text not null default 'signed_up' check (status in ('signed_up', 'rewarding', 'rewarded')),
  plan_bought text,
  reward_type text,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on referrals (referrer_id);

alter table referral_codes enable row level security;
alter table referrals enable row level security;

drop policy if exists "read own referral code" on referral_codes;
create policy "read own referral code" on referral_codes for select using (auth.uid() = user_id);

drop policy if exists "read own referrals" on referrals;
create policy "read own referrals" on referrals for select using (auth.uid() = referrer_id or auth.uid() = referred_id);
