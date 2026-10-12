-- Read-only checks after applying 20261012140000_training_feedback_loop.sql. Every row should say "ok".
select 'workout_sessions.assignment_id exists' as check,
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_sessions' and column_name='assignment_id' and data_type='uuid') then 'ok' else 'MISSING' end as result
union all select 'workout_assignments.result exists (jsonb)',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_assignments' and column_name='result' and data_type='jsonb') then 'ok' else 'MISSING' end
union all select 'workout_assignments.feedback_seen_at exists',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_assignments' and column_name='feedback_seen_at') then 'ok' else 'MISSING' end
union all select 'member_notifications.related_assignment_id exists',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='member_notifications' and column_name='related_assignment_id') then 'ok' else 'MISSING' end
union all select 'feedback table exists with row level security on',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.workout_assignment_feedback')) then 'ok' else 'MISSING OR OFF' end
union all select 'feedback table has its three rules',
       case when (select count(*) from pg_policies where schemaname='public' and tablename='workout_assignment_feedback') = 3 then 'ok' else 'COUNT ' || (select count(*) from pg_policies where schemaname='public' and tablename='workout_assignment_feedback') end
union all select 'anonymous has no access to feedback',
       case when not has_table_privilege('anon', 'public.workout_assignment_feedback', 'select') then 'ok' else 'ANON CAN READ' end
union all select 'workout sessions have the ownership check',
       case when exists (select 1 from pg_trigger where tgname = 'workout_session_assignment_owner' and tgrelid = 'public.workout_sessions'::regclass and not tgisinternal) then 'ok' else 'MISSING' end
union all select 'members can read notifications and mark them read, and change nothing else',
       case when has_table_privilege('authenticated','public.member_notifications','select') and has_column_privilege('authenticated','public.member_notifications','read_at','update') and not has_column_privilege('authenticated','public.member_notifications','title','update') and not has_table_privilege('anon','public.member_notifications','select') then 'ok' else 'WRONG' end
union all select 'both notification triggers exist',
       case when (select count(*) from pg_trigger where tgname in ('workout_assigned_notification','workout_feedback_notification') and not tgisinternal) = 2 then 'ok' else 'MISSING' end
union all select 'no existing assignment was given a result or a reply',
       case when (select count(*) from public.workout_assignments where workout_assignments.result is not null or workout_assignments.feedback_seen_at is not null) = 0 then 'ok' else 'UNEXPECTED' end;
