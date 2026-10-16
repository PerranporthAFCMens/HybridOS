-- Every row must say ok. Read-only.
select 'the table exists with row level security on' as check_name,
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relname = 'block_benchmarks' and c.relrowsecurity) then 'ok' else 'WRONG' end as result
union all
select 'signed-out people have no access',
       case when not has_table_privilege('anon', 'public.block_benchmarks', 'select') and not has_table_privilege('anon', 'public.block_benchmarks', 'insert') then 'ok' else 'WRONG' end
union all
select 'there is a read rule for the gym and a manage rule for owners and admins',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'block_benchmarks') = 2 then 'ok' else 'WRONG' end
union all
select 'a block cannot test the same movement twice',
       case when exists (select 1 from pg_constraint where conname = 'block_benchmarks_block_movement_unique') then 'ok' else 'WRONG' end
union all
select 'the end test must come after the start test',
       case when exists (select 1 from pg_constraint where conname = 'block_benchmarks_dates_check') then 'ok' else 'WRONG' end;
