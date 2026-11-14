-- Marks which subscription rows are actually paid for.
-- Before this, opening checkout wrote a row straight away (status 'incomplete'), so the table was full of
-- unpaid attempts that looked like subscriptions.
--   paid = true   a real paying subscription: Stripe has taken a payment and it is active or trialing
--   paid_at       when the most recent payment went through
--   paid = false  an unpaid checkout attempt, a cancelled or lapsed subscription, or a tester you comped by hand
-- Access to plan features still goes by status, exactly as before. This column is for you, to see who really pays.
alter table public.subscriptions add column if not exists paid boolean not null default false;
alter table public.subscriptions add column if not exists paid_at timestamptz;

-- Fill it in for the rows already there: a Stripe subscription that is active or trialing has been paid
update public.subscriptions
set paid = true, paid_at = coalesce(paid_at, now())
where stripe_subscription_id is not null and status in ('active', 'trialing') and paid = false;

create index if not exists subscriptions_paid_idx on public.subscriptions (paid);

-- A quick view for the Table Editor: only people who really pay
create or replace view public.paying_subscriptions
with (security_invoker = true) as
select user_id, plan, billing_interval, status, paid_at, current_period_end, stripe_customer_id, stripe_subscription_id
from public.subscriptions
where paid = true;
revoke all on public.paying_subscriptions from anon, authenticated;
