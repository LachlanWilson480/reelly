-- ============================================================================
-- GIVE SOMEONE A PLAN FOR FREE, FOR A SET NUMBER OF MONTHS
-- For example: Dave's Cafe on Pro for 3 months, Bob's Concrete on Pro for 2 months.
-- Nothing is charged. When the time is up they go back to the Free plan by themselves
-- (Reelezy checks every night), and none of their videos or ideas are deleted.
-- Run these in Supabase: SQL Editor > New query > paste > Run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1. ONE TIME SETUP. Run this whole part once. Running it again does no harm.
-- ----------------------------------------------------------------------------
alter table public.subscriptions add column if not exists manual_until timestamptz;

-- Finds one account from a business name or an email address
-- The name to show for an account: its business name, or its email if it has none
create or replace function public.reelezy_account_name(account uuid)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select coalesce(nullif(trim(b.business_name), ''), u.email)
  from auth.users u left join public.business_profiles b on b.user_id = u.id
  where u.id = account
$$;

create or replace function public.reelezy_find_account(who text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  found_id uuid;
  how_many int;
  names text;
begin
  if who is null or length(trim(who)) = 0 then
    raise exception 'Type a business name or an email address.';
  end if;

  if position('@' in who) > 0 then
    select count(*), min(id::text)::uuid into how_many, found_id from auth.users where lower(email) = lower(trim(who));
  else
    select count(*), min(user_id::text)::uuid into how_many, found_id from public.business_profiles where lower(trim(business_name)) = lower(trim(who));
  end if;

  if how_many = 0 then
    raise exception 'No account found for "%". Check the spelling, or use their email address instead.', who;
  end if;
  if how_many > 1 then
    select string_agg(u.email, ', ') into names
    from public.business_profiles b join auth.users u on u.id = b.user_id
    where lower(trim(b.business_name)) = lower(trim(who));
    raise exception 'More than one account is called "%" (%). Use their email address instead.', who, names;
  end if;
  return found_id;
end;
$$;

-- Gives a plan for a number of months, counted from today
create or replace function public.give_plan(who text, plan_name text, months int)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  account uuid;
  plan_id text;
  ends timestamptz;
  current_row public.subscriptions%rowtype;
begin
  if months is null or months < 1 or months > 36 then
    raise exception 'Months has to be between 1 and 36.';
  end if;
  plan_id := case lower(trim(plan_name)) when 'pro' then 'top' when 'top' then 'top' when 'basic' then 'basic' else null end;
  if plan_id is null then
    raise exception 'The plan has to be Basic or Pro.';
  end if;

  account := public.reelezy_find_account(who);

  select * into current_row from public.subscriptions where user_id = account;
  if found and current_row.stripe_subscription_id is not null and current_row.status in ('active', 'trialing', 'past_due') then
    raise exception '"%" pays through Stripe already, so this would clash with their billing. Change their plan in the Stripe dashboard instead.', who;
  end if;

  ends := now() + make_interval(months => months);

  insert into public.subscriptions (user_id, plan, status, paid, manual_until, current_period_end, deletion_scheduled_at, deletion_warning_sent)
  values (account, plan_id, 'active', false, ends, ends, null, false)
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = 'active',
    paid = false,
    manual_until = excluded.manual_until,
    current_period_end = excluded.current_period_end,
    stripe_subscription_id = null,
    deletion_scheduled_at = null,
    deletion_warning_sent = false;

  -- Start the weekly limits fresh, the same as when someone subscribes
  update public.business_profiles
  set ideas_generated_this_week = 0, filming_generated_this_week = 0, scripts_generated_this_week = 0, usage_reset_at = now()
  where user_id = account;

  return format('Done. %s is on %s until %s.', public.reelezy_account_name(account), case plan_id when 'top' then 'Pro' else 'Basic' end,
    to_char(ends at time zone 'Australia/Sydney', 'FMDD Mon YYYY'));
end;
$$;

-- Ends a given plan straight away (they go back to Free)
create or replace function public.end_given_plan(who text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  account uuid;
begin
  account := public.reelezy_find_account(who);
  update public.subscriptions
  set status = 'canceled', paid = false, manual_until = now(), current_period_end = now()
  where user_id = account and stripe_subscription_id is null and manual_until is not null and status = 'active';
  if not found then
    raise exception '"%" does not have a plan given by hand right now.', who;
  end if;
  return format('Done. %s is back on the Free plan.', public.reelezy_account_name(account));
end;
$$;

-- A list of everyone with a given plan, newest end date last
create or replace view public.given_plans
with (security_invoker = true) as
select b.business_name, u.email,
  case s.plan when 'top' then 'Pro' else 'Basic' end as plan,
  to_char(s.manual_until at time zone 'Australia/Sydney', 'FMDD Mon YYYY') as free_until,
  case when s.status = 'active' and s.manual_until > now() then 'Running' else 'Ended' end as state
from public.subscriptions s
join auth.users u on u.id = s.user_id
left join public.business_profiles b on b.user_id = s.user_id
where s.manual_until is not null and s.stripe_subscription_id is null
order by s.manual_until;
revoke all on public.given_plans from anon, authenticated;

-- Only you (in the SQL Editor) can run these. Nobody can call them from the website.
revoke all on function public.reelezy_find_account(text) from public, anon, authenticated;
revoke all on function public.reelezy_account_name(uuid) from public, anon, authenticated;
revoke all on function public.give_plan(text, text, int) from public, anon, authenticated;
revoke all on function public.end_given_plan(text) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- STEP 2. GIVE A PLAN. Copy a line into a new query, delete the -- at its start,
-- change the name, plan and months, then run it.
-- Use the business name exactly as they typed it, or their email address.
-- Plan is 'pro' or 'basic'. Months are counted from today.
-- Write an apostrophe as two: Dave's Cafe is written 'Dave''s Cafe'.
-- ----------------------------------------------------------------------------
-- select public.give_plan('Dave''s Cafe', 'pro', 3);
-- select public.give_plan('Bob''s Concrete', 'pro', 2);
-- select public.give_plan('someone@example.com', 'basic', 1);


-- ----------------------------------------------------------------------------
-- OTHER THINGS YOU CAN DO. Same again: copy, delete the -- at the start, then run.
-- ----------------------------------------------------------------------------

-- Give more time: run give_plan again. The months count from today, and it replaces the old end date.

-- End a given plan now
-- select public.end_given_plan('Dave''s Cafe');

-- See everyone who has a given plan, and when it ends
-- select * from public.given_plans;
