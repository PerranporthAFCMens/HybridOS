-- Every row must say ok. Read-only.
select 'workout_sessions has a level column' as check_name,
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_sessions' and column_name='level') then 'ok' else 'WRONG' end as result
union all
select 'workout_entries has a movement_id column',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_entries' and column_name='movement_id') then 'ok' else 'WRONG' end
union all
select 'the other-gym check exists and nobody can call it directly',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='check_entry_movement_gym')
             and not has_function_privilege('authenticated', 'private.check_entry_movement_gym()', 'execute') then 'ok' else 'WRONG' end
union all
select 'the check is attached to workout_entries',
       case when exists (select 1 from pg_trigger where tgname='workout_entries_movement_gym' and not tgisinternal) then 'ok' else 'WRONG' end;
