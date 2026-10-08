-- Read-only verification for 20261008090000_class_schedule_override.sql. Every row must end in "| t".
select 'override table exists' as check, to_regclass('public.class_schedule_overrides') is not null;
select 'override table has row level security',
  coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.class_schedule_overrides')), false);
select 'override table has exactly one policy, a select for authenticated',
  (select count(*) from pg_policies where schemaname='public' and tablename='class_schedule_overrides') = 1
  and exists(select 1 from pg_policies where schemaname='public' and tablename='class_schedule_overrides' and cmd='SELECT' and roles = '{authenticated}');
select 'anon has no access to the override table',
  not has_table_privilege('anon', 'public.class_schedule_overrides', 'select,insert,update,delete');
select 'authenticated can only read the override table',
  has_table_privilege('authenticated', 'public.class_schedule_overrides', 'select')
  and not has_table_privilege('authenticated', 'public.class_schedule_overrides', 'insert,update,delete');
select 'new 12-argument function exists, security definer',
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname='create_validated_class_session' and p.pronargs=12 and p.prosecdef);
select 'old 11-argument function is gone (one function of that name)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_validated_class_session') = 1;
select 'only authenticated can run it',
  has_function_privilege('authenticated', 'public.create_validated_class_session(uuid,uuid,text,text,timestamptz,timestamptz,integer,integer,integer,uuid[],uuid[],text)', 'execute')
  and not has_function_privilege('anon', 'public.create_validated_class_session(uuid,uuid,text,text,timestamptz,timestamptz,integer,integer,integer,uuid[],uuid[],text)', 'execute');
select 'validate_class_schedule is unchanged (still 7 arguments)',
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='validate_class_schedule' and p.pronargs=7);
