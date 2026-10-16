-- Every row must say ok. Read-only.
select 'both tables exist with row level security on' as check_name,
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname in ('movements', 'movement_levels') and c.relrowsecurity) = 2 then 'ok' else 'WRONG' end as result
union all
select 'signed-out people have no access to either table',
       case when not has_table_privilege('anon', 'public.movements', 'select') and not has_table_privilege('anon', 'public.movement_levels', 'select')
             and not has_table_privilege('anon', 'public.movements', 'insert') and not has_table_privilege('anon', 'public.movement_levels', 'insert') then 'ok' else 'WRONG' end
union all
select 'signed-in people cannot delete a movement',
       case when has_table_privilege('authenticated', 'public.movements', 'insert') and has_table_privilege('authenticated', 'public.movements', 'update')
             and not has_table_privilege('authenticated', 'public.movements', 'delete') then 'ok' else 'WRONG' end
union all
select 'each table has a read rule and write rules',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'movements') = 3
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'movement_levels') = 4 then 'ok' else 'WRONG' end
union all
select 'a gym cannot have the same movement twice',
       case when exists (select 1 from pg_constraint where conname = 'movements_gym_key_unique') then 'ok' else 'WRONG' end;
