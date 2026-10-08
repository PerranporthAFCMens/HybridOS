-- Read-only checks after applying 20261010120000_workout_set_side.sql. Every row should say "ok".
select 'column exists' as check,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workout_sets' and column_name = 'side' and data_type = 'text' and is_nullable = 'YES') then 'ok' else 'MISSING' end as result
union all
select 'check constraint exists',
       case when exists (select 1 from pg_constraint where conname = 'workout_sets_side_check' and conrelid = 'public.workout_sets'::regclass) then 'ok' else 'MISSING' end
union all
select 'no existing set was given a side',
       case when (select count(*) from public.workout_sets where side is not null) = 0 then 'ok' else 'UNEXPECTED: ' || (select count(*) from public.workout_sets where side is not null) end
union all
select 'row level security still on',
       case when (select relrowsecurity from pg_class where oid = 'public.workout_sets'::regclass) then 'ok' else 'OFF' end;
