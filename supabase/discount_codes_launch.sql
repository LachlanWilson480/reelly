-- Launch discount codes. Safe to run more than once: a code that already exists is left alone.
-- Each code takes the percentage off the FIRST payment only (first month, or first year on yearly billing).
-- Stripe coupons are created automatically at checkout, so nothing needs setting up in Stripe.
insert into discount_codes (code, percent_off, active, uses, max_uses, expires_at)
select v.code, v.percent_off, true, 0, v.max_uses, v.expires_at::timestamptz
from (values
  ('LAUNCH50',  50, 100,  '2027-01-01 00:00:00+11'),  -- launch offer: 50% off, first 100 people, ends 31 Dec
  ('EARLY30',   30, 300,  '2027-03-01 00:00:00+11'),  -- early adopters: 30% off, until end of Feb
  ('WELCOME20', 20, null, null),                      -- general code for emails and the website, no limit
  ('PARTNER25', 25, 50,   null)                       -- template for an influencer or partner, copy and rename
) as v(code, percent_off, max_uses, expires_at)
where not exists (select 1 from discount_codes d where d.code = v.code);

-- See every code and how many times it has been used
select code, percent_off, active, uses, max_uses, expires_at from discount_codes order by code;
