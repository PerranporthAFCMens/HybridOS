-- Every row must say ok. Read-only.
select 'the table exists with row level security on' as check_name,
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relname = 'gym_targets' and c.relrowsecurity) then 'ok' else 'WRONG' end as result
union all
select 'signed-out people have no access',
       case when not has_table_privilege('anon', 'public.gym_targets', 'select') and not has_table_privilege('anon', 'public.gym_targets', 'insert') then 'ok' else 'WRONG' end
union all
select 'two rules: owners and admins manage, staff read their own',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_targets') = 2 then 'ok' else 'WRONG' end
union all
select 'one target per gym, person and measure',
       case when exists (select 1 from pg_constraint where conname = 'gym_targets_one_each') then 'ok' else 'WRONG' end;
