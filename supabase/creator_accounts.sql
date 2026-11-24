-- ============================================================================
-- CREATOR ACCOUNTS
-- A small business gets Reelezy free for a set number of months, in return for social media content.
-- You make a one-time code for them on reelezy.com/admin (Creator accounts). They make a free account,
-- go to Plans and type the code in the Code box. The code then belongs to them and nobody else can use it.
-- While it runs, the Made with Reelezy badge stays on every video and cannot be removed.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Running it again does no harm.
-- ============================================================================

-- When the creator account ends. The badge is locked on until then.
alter table public.subscriptions add column if not exists creator_until timestamptz;

create table if not exists public.creator_access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                        -- what they type, usually their handle, like DAVEYSBARBER
  name text,                                        -- who it is for: business name or handle
  note text,
  plan text not null default 'top' check (plan in ('basic', 'top')),
  months int not null default 3 check (months between 1 and 36),
  active boolean not null default true,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only the server can read or change these. Nobody can reach them from the browser.
alter table public.creator_access_codes enable row level security;
