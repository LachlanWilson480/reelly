-- Stops signed-in people changing things only the server should change, by talking to the database directly
-- from their browser with their own login (which anyone can do with the public Supabase key).
-- The server uses the service role, which this does not affect. Safe to run more than once.

-- 1. Tables only the server writes to. The app's own pages only ever read these.
do $$
declare t text;
begin
  foreach t in array array['subscriptions', 'referrals', 'ai_spend', 'scheduled_posts', 'post_metrics', 'draft_clips', 'discount_codes', 'social_connections', 'referral_rewards'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Discount codes and connected social accounts (with their access tokens) are never read from the browser
do $$
begin
  if to_regclass('public.discount_codes') is not null then revoke select on public.discount_codes from anon, authenticated; end if;
  if to_regclass('public.social_connections') is not null then revoke select on public.social_connections from anon, authenticated; end if;
  if to_regclass('public.ai_spend') is not null then revoke select on public.ai_spend from anon; end if;
end $$;

-- 2. Renders: people may rename their videos, edit the description and hashtags, and move a video between
-- "done" and "cleared". Everything else (who owns it, the video link, render minutes used) is kept as it was.
create or replace function public.protect_render_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id := old.id;
    new.user_id := old.user_id;
    new.output_url := old.output_url;
    new.duration_seconds := old.duration_seconds;
    new.shotstack_render_id := old.shotstack_render_id;
    new.over_quota := old.over_quota;
    new.created_at := old.created_at;
    new.idea_id := old.idea_id;
    new.source := old.source;
    if not (old.status in ('done', 'cleared') and new.status in ('done', 'cleared')) then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_render_columns on public.renders;
create trigger protect_render_columns before update on public.renders for each row execute function public.protect_render_columns();
revoke insert, delete on public.renders from anon, authenticated;

-- 3. Business profiles: people edit their own settings, but not the usage counters that enforce plan limits
create or replace function public.protect_profile_counters()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.ideas_generated_this_week := 0;
      new.filming_generated_this_week := 0;
      new.scripts_generated_this_week := 0;
      new.free_ideas_used := 0;
    else
      new.user_id := old.user_id;
      new.ideas_generated_this_week := old.ideas_generated_this_week;
      new.filming_generated_this_week := old.filming_generated_this_week;
      new.scripts_generated_this_week := old.scripts_generated_this_week;
      new.usage_reset_at := old.usage_reset_at;
      new.free_ideas_used := old.free_ideas_used;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_counters on public.business_profiles;
create trigger protect_profile_counters before insert or update on public.business_profiles for each row execute function public.protect_profile_counters();
revoke delete on public.business_profiles from anon, authenticated;

-- 4. Nobody signed out can write anything at all
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete on public.%I from anon', r.tablename);
  end loop;
end $$;
