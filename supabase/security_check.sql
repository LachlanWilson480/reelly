-- Read-only security check. Paste into Supabase SQL Editor and press Run. It changes nothing.
-- Every row should say "OK". Anything else is listed with what to do about it.
with t as (
  select c.relname as table_name, c.relrowsecurity as rls_on,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
         (select string_agg(distinct p.cmd, ', ') from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and (p.qual is null or p.qual not ilike '%auth.uid()%') and p.cmd <> 'SELECT') as loose_write_policies,
         has_table_privilege('anon', c.oid, 'SELECT') as anon_can_read
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
)
select * from (
select table_name,
  case
    when not rls_on then 'FIX: row level security is OFF, so anyone can read every row. Turn it on for this table.'
    when loose_write_policies is not null then 'CHECK: a ' || loose_write_policies || ' policy does not check auth.uid(), so people may change other people''s rows.'
    when rls_on and policies = 0 then 'OK (locked: only the server can use it)'
    else 'OK'
  end as result,
  policies, anon_can_read
from t
) r
order by (result like 'OK%') asc, table_name;

-- Storage: each bucket should be private, and its policies should limit people to their own folder
select id as bucket, public as is_public,
  case when public then 'CHECK: this bucket is public, so anyone with a file link can open it' else 'OK' end as result
from storage.buckets;
