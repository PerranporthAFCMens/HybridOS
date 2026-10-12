-- Read-only. Run AFTER applying 20261012180000_class_workouts.sql. Every row should say "ok".
select 'the class workouts table exists with row security on' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.class_session_workouts'::regclass) then 'ok' else 'MISSING' end as result
union all
select 'it has the two access rules (class staff manage; people in the class read once available)',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_session_workouts') = 2 then 'ok' else 'WRONG' end
union all
select 'signed-in people can use it (the rules decide who), nobody else can',
       case when has_table_privilege('authenticated', 'public.class_session_workouts', 'select')
             and has_table_privilege('authenticated', 'public.class_session_workouts', 'insert')
             and not has_table_privilege('anon', 'public.class_session_workouts', 'select')
             and not has_table_privilege('service_role', 'public.class_session_workouts', 'select') then 'ok' else 'WRONG' end
union all
select 'a finished workout can point at a class',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workout_sessions' and column_name = 'class_session_id') then 'ok' else 'MISSING' end
union all
select 'the in-the-class check is on workout sessions',
       case when exists (select 1 from pg_trigger where tgrelid = 'public.workout_sessions'::regclass and tgname = 'workout_session_class_member' and not tgisinternal) then 'ok' else 'MISSING' end
union all
select 'the notification trigger is in place',
       case when exists (select 1 from pg_trigger where tgrelid = 'public.class_session_workouts'::regclass and tgname = 'class_workout_available_notification' and not tgisinternal) then 'ok' else 'MISSING' end
union all
select 'the helper functions are not callable from the app',
       case when not has_function_privilege('authenticated', 'private.enforce_session_class()', 'execute')
             and not has_function_privilege('authenticated', 'private.notify_class_workout_available()', 'execute') then 'ok' else 'TOO OPEN' end;
