-- TikTok posting choices (who can view, comments, duet, stitch, commercial content) saved with each scheduled post.
alter table scheduled_posts add column if not exists tiktok_options jsonb;
