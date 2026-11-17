-- Lets a finished video be opened in the editor again (Edit in Publish), and keeps earlier versions of it.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Running it again does no harm.

-- Everything needed to open the video in the editor again: its clips, sounds, captions and settings
alter table public.renders add column if not exists project jsonb;

-- The first video in a chain of edits. Each new version points at it, and Publish shows only the newest.
alter table public.renders add column if not exists version_of uuid references public.renders(id) on delete set null;
create index if not exists renders_version_of_idx on public.renders (version_of);
