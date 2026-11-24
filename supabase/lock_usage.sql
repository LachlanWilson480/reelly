-- ============================================================================
-- LOCK USAGE LIMITS
-- People can edit their own business profile (Settings) and their own videos, but they must not be able to
-- change the numbers their limits are worked out from: weekly idea, plan and script counts, free ideas used,
-- and how long each video is (render minutes). The server (service key) can still change everything.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Running it again does no harm.
-- ============================================================================

-- Business profiles: the usage counters only change on the server
create or replace function public.reelezy_keep_usage_counters()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.ideas_generated_this_week := 0;
      new.filming_generated_this_week := 0;
      new.scripts_generated_this_week := 0;
      new.free_ideas_used := 0;
    else
      new.ideas_generated_this_week := old.ideas_generated_this_week;
      new.filming_generated_this_week := old.filming_generated_this_week;
      new.scripts_generated_this_week := old.scripts_generated_this_week;
      new.free_ideas_used := old.free_ideas_used;
      new.usage_reset_at := old.usage_reset_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reelezy_keep_usage_counters on public.business_profiles;
create trigger reelezy_keep_usage_counters
  before insert or update on public.business_profiles
  for each row execute function public.reelezy_keep_usage_counters();

-- Videos: from the browser, the only change allowed is putting a cleared video back (status done or cleared).
-- Everything else, including the video's length, stays as the server saved it.
create or replace function public.reelezy_keep_render_rows()
returns trigger
language plpgsql
as $$
declare
  wanted text;
begin
  if current_user in ('authenticated', 'anon') then
    wanted := new.status;
    new := old;
    if wanted in ('done', 'cleared') and old.status in ('done', 'cleared') then
      new.status := wanted;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reelezy_keep_render_rows on public.renders;
create trigger reelezy_keep_render_rows
  before update on public.renders
  for each row execute function public.reelezy_keep_render_rows();

-- Videos are only ever created by the server, so the browser does not need to add them
drop policy if exists "Users can insert their own renders" on public.renders;
