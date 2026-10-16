-- Every row must say ok. Read-only.
select 'the switch table exists with row level security on' as check_name,
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relname = 'gym_benchmark_settings' and c.relrowsecurity) then 'ok' else 'WRONG' end as result
union all
select 'signed-out people have no access to the switch',
       case when not has_table_privilege('anon', 'public.gym_benchmark_settings', 'select') and not has_table_privilege('anon', 'public.gym_benchmark_settings', 'insert') then 'ok' else 'WRONG' end
union all
select 'there is a read rule for members and a manage rule for owners and admins',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_benchmark_settings') = 2 then 'ok' else 'WRONG' end
union all
select 'the results function exists and is signed-in only',
       case when exists (select 1 from pg_proc where oid = 'public.get_block_benchmark_results(uuid)'::regprocedure)
             and has_function_privilege('authenticated', 'public.get_block_benchmark_results(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_block_benchmark_results(uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the switch is off unless an owner turns it on',
       case when (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'gym_benchmark_settings' and column_name = 'coaches_see_results') = 'false' then 'ok' else 'WRONG' end;
