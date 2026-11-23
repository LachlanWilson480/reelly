-- ============================================================================
-- CREATOR PAYOUTS
-- Creators who share a Reelezy code earn a share of what each person who joins with it pays.
-- Everything day to day happens on reelezy.com/admin/creators. This file is only the one time setup.
-- Run it in Supabase: SQL Editor > New query > paste > Run. Running it again does no harm.
-- ============================================================================

-- One row per creator
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  code text not null unique,                         -- the discount code they share, like DAVEY80
  commission_percent numeric(5,2) not null default 20 check (commission_percent between 0 and 100),
  commission_months int default 12 check (commission_months is null or commission_months between 1 and 120), -- null = for as long as the person stays subscribed
  abn text,
  supplier_statement boolean not null default false, -- true = they gave you a signed ATO Statement by a supplier instead of an ABN
  agreement_signed boolean not null default false,   -- they signed the creator agreement (#ad disclosure, your right to repost and use their videos in ads)
  bsb text,
  account_number text,
  account_name text,
  note text,
  active boolean not null default true,              -- false = no new commission is earned
  last_statement_period text,
  created_at timestamptz not null default now()
);

-- One row per payment that earned commission. Refunds after payout add a negative row.
create table if not exists public.creator_commissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  user_id uuid,
  plan text,
  billing_interval text,
  currency text not null default 'aud',
  list_cents int not null default 0,                 -- the plan price before the code discount
  paid_cents int not null default 0,                 -- what the customer actually paid
  commission_cents int not null default 0,           -- commission in the customer's currency
  commission_aud_cents int,                          -- commission in AUD, worked out when the 30 day hold ends
  paid_at timestamptz not null default now(),
  payable_after timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'payable', 'paid', 'reversed', 'check')),
  reason text,
  clawed_back boolean not null default false,
  payout_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists creator_commissions_creator_idx on public.creator_commissions (creator_id, status);

-- One row per payment you make to a creator
create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  period text not null,                              -- like 2026-11
  total_cents int not null,
  withheld_cents int not null default 0,             -- 47% held back for the ATO when there is no ABN or supplier statement
  net_cents int not null,
  status text not null default 'owed' check (status in ('owed', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.creator_commissions add constraint creator_commissions_payout_fk foreign key (payout_id) references public.creator_payouts(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Only the server can read or change these. Nobody can reach them from the browser.
alter table public.creators enable row level security;
alter table public.creator_commissions enable row level security;
alter table public.creator_payouts enable row level security;
