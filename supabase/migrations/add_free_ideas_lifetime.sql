-- Free plan: 24 ideas in total (lifetime). Counting starts at 0 for everyone from the day this runs.
alter table business_profiles add column if not exists free_ideas_used integer not null default 0;
