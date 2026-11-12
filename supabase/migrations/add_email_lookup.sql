-- Finds every account that uses an email address in one quick query, instead of paging through every user.
-- Used by the free-plan render limit (one allowance per email, even across repeat sign-ups) and the login page.
-- Only the server (service role) can call it, so nobody can use it to look up who has an account.
create or replace function public.user_ids_for_email(p_email text)
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email))
$$;

revoke all on function public.user_ids_for_email(text) from public;
revoke all on function public.user_ids_for_email(text) from anon, authenticated;
grant execute on function public.user_ids_for_email(text) to service_role;
