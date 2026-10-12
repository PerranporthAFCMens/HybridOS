-- Read-only checks after applying 20261012120000_community_broadcasts.sql. Every row should say "ok".
select 'column exists, text, not null, default post' as check,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'social_posts' and column_name = 'kind' and data_type = 'text' and is_nullable = 'NO' and column_default like '''post''%') then 'ok' else 'MISSING' end as result
union all
select 'check constraint exists',
       case when exists (select 1 from pg_constraint where conname = 'social_posts_kind_check' and conrelid = 'public.social_posts'::regclass) then 'ok' else 'MISSING' end
union all
select 'every existing post is an ordinary post',
       case when (select count(*) from public.social_posts where kind <> 'post') = 0 then 'ok' else 'UNEXPECTED: ' || (select count(*) from public.social_posts where kind <> 'post') end
union all
select 'create rule checks the post kind',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'social_posts' and policyname = 'gym members create social posts' and cmd = 'INSERT' and with_check like '%kind%') then 'ok' else 'WRONG' end
union all
select 'update rule checks the post kind',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'social_posts' and policyname = 'authors or admins update social posts' and cmd = 'UPDATE' and with_check like '%kind%') then 'ok' else 'WRONG' end
union all
select 'social_posts has the same number of rules as before (4)',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'social_posts') = 4 then 'ok' else 'COUNT ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'social_posts') end
union all
select 'row level security still on',
       case when (select relrowsecurity from pg_class where oid = 'public.social_posts'::regclass) then 'ok' else 'OFF' end;
