-- ============================================================================
-- CREATOR CODES
-- Codes a creator gives their followers, like SARAH1MONTH = "first 100 people get 1 month of Reelezy free".
-- Run these in Supabase: SQL Editor > New query > paste > Run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1. ONE TIME SETUP. Run this part once. Running it again does no harm.
-- ----------------------------------------------------------------------------
alter table public.discount_codes add column if not exists months int not null default 1;              -- how many monthly payments the discount covers
alter table public.discount_codes add column if not exists monthly_only boolean not null default false;  -- true = monthly billing only (stops 100% off giving a free year)
alter table public.discount_codes add column if not exists plans text[];                                 -- null = any plan. {pro} = Pro only. {basic} = Basic only
alter table public.discount_codes add column if not exists new_customers_only boolean not null default false; -- true = people who have paid before cannot use it
alter table public.discount_codes add column if not exists note text;                                    -- your own note, for example who the creator is
do $$ begin
  alter table public.discount_codes add constraint discount_codes_months_check check (months between 1 and 12);
exception when duplicate_object then null; end $$;


-- ----------------------------------------------------------------------------
-- STEP 2. MAKE A CODE. Change the values on the left, then run.
-- The new code shows in the results. If nothing shows, you left the name as CREATORNAME1MONTH,
-- or that code name is already taken.
-- ----------------------------------------------------------------------------
with settings as (
  select
    'CREATORNAME1MONTH'             as code,          -- what people type, like SARAH1MONTH. Letters and numbers only
    100                             as percent_off,   -- 100 = free. 50 = half price
    1                               as months,        -- how many months it covers. 1 = first month, 3 = first 3 months
    100                             as max_uses,      -- how many people can use it. null = no limit
    null                            as expires_at,    -- last day it works, like '2027-03-01 00:00+11'. null = never
    null                            as plans,         -- null = any plan. array['pro'] = Pro only. array['basic'] = Basic only
    true                            as monthly_only,  -- keep true for free months, so nobody gets a free year on yearly billing
    true                            as new_customers_only, -- true = only people who have never paid for Reelezy
    'Creator name and their handle' as note           -- who it is for, just for you
)
insert into public.discount_codes (code, percent_off, months, max_uses, expires_at, plans, monthly_only, new_customers_only, note, active, uses)
select upper(regexp_replace(s.code, '[^A-Za-z0-9]', '', 'g')), s.percent_off, s.months::int, s.max_uses::int, s.expires_at::text::timestamptz,
  (select array_agg(lower(trim(x))) from unnest(s.plans::text[]) x), s.monthly_only::boolean, s.new_customers_only::boolean, s.note, true, 0
from settings s
where upper(s.code) <> 'CREATORNAME1MONTH'
  and not exists (select 1 from public.discount_codes d where d.code = upper(regexp_replace(s.code, '[^A-Za-z0-9]', '', 'g')))
returning code, percent_off, months, max_uses, expires_at, plans, monthly_only, new_customers_only, note;


-- ----------------------------------------------------------------------------
-- OTHER THINGS YOU CAN DO. Copy a line into a new query, delete the -- at its start,
-- change the code name, then run it.
-- ----------------------------------------------------------------------------

-- See every code and how many people have used it (a use counts once their first payment goes through)
-- select code, note, percent_off, months, uses, max_uses, expires_at, plans, monthly_only, new_customers_only, active
-- from public.discount_codes order by code;

-- Turn a code off straight away
-- update public.discount_codes set active = false where code = 'SARAH1MONTH';

-- Turn it back on
-- update public.discount_codes set active = true where code = 'SARAH1MONTH';

-- Let more people use it (here, 200 in total)
-- update public.discount_codes set max_uses = 200 where code = 'SARAH1MONTH';

-- Make it stop working after a date
-- update public.discount_codes set expires_at = '2027-03-01 00:00+11' where code = 'SARAH1MONTH';


-- ----------------------------------------------------------------------------
-- EXAMPLES. Swap these into the settings in step 2.
--   1 month free, first 100 people:     percent_off 100, months 1, max_uses 100
--   3 months free, first 20 people:     percent_off 100, months 3, max_uses 20
--   50% off the first 2 months:         percent_off 50,  months 2, max_uses null
--   1 month of Pro free, Pro only:      percent_off 100, months 1, plans array['pro']
-- ----------------------------------------------------------------------------
