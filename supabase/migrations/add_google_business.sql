-- Lets a person store their Google Business Profile connection next to their social accounts.
-- Run once in the Supabase SQL editor.
alter table social_connections drop constraint if exists social_connections_platform_check;
alter table social_connections add constraint social_connections_platform_check
  check (platform in ('youtube', 'linkedin', 'facebook', 'instagram', 'tiktok', 'google_business'));
