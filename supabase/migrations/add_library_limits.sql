-- Clip library limits, enforced in the database so they cannot be skipped from the browser.
-- Keep these numbers in step with LIBRARY_LIMITS in lib/planLimits.ts.
--   Free (no active plan): 500 MB, 25 clips
--   Basic:                 5 GB, 150 clips
--   Pro:                   10 GB, 400 clips
--   Any plan:              500 MB per clip
create or replace function enforce_clip_library_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sub_plan text;
  sub_status text;
  max_bytes bigint;
  max_clips int;
  used_bytes bigint;
  used_clips int;
begin
  if new.size_bytes > 500 * 1024 * 1024 then
    raise exception 'That clip is over 500 MB, which is too big for the library.';
  end if;

  select plan, status into sub_plan, sub_status from subscriptions where user_id = new.user_id limit 1;
  if sub_status in ('active', 'trialing') and sub_plan = 'top' then
    max_bytes := 10240::bigint * 1024 * 1024; max_clips := 400;
  elsif sub_status in ('active', 'trialing') and sub_plan in ('mid', 'basic') then
    max_bytes := 5120::bigint * 1024 * 1024; max_clips := 150;
  else
    max_bytes := 500::bigint * 1024 * 1024; max_clips := 25;
  end if;

  select coalesce(sum(size_bytes), 0), count(*) into used_bytes, used_clips from clip_library where user_id = new.user_id;
  if used_clips >= max_clips then
    raise exception 'Your library is full (% clips). Delete a clip or upgrade your plan to add more.', max_clips;
  end if;
  if used_bytes + new.size_bytes > max_bytes then
    raise exception 'Not enough library space for this clip. Delete a clip or upgrade your plan.';
  end if;
  return new;
end $$;

drop trigger if exists clip_library_limits on clip_library;
create trigger clip_library_limits before insert on clip_library
  for each row execute function enforce_clip_library_limits();
