-- Read-only. Run AFTER applying 20261012160000_training_notify_service_access.sql. Every row should say "ok".
select 'the service role can read the workout columns the email needs' as check,
       case when has_column_privilege('service_role', 'public.workout_assignments', 'title', 'select')
             and has_column_privilege('service_role', 'public.workout_assignments', 'member_user_id', 'select')
             and has_column_privilege('service_role', 'public.workout_assignments', 'workout_snapshot', 'select') then 'ok' else 'CANNOT' end as result
union all
select 'but not the client''s own report or notes',
       case when not has_column_privilege('service_role', 'public.workout_assignments', 'result', 'select')
             and not has_column_privilege('service_role', 'public.workout_assignments', 'member_notes', 'select') then 'ok' else 'TOO MUCH' end
union all
select 'it can read the coach''s replies',
       case when has_table_privilege('service_role', 'public.workout_assignment_feedback', 'select') then 'ok' else 'CANNOT' end
union all
select 'and can write nothing here',
       case when not has_table_privilege('service_role', 'public.workout_assignment_feedback', 'insert')
             and not has_table_privilege('service_role', 'public.workout_assignment_feedback', 'update')
             and not has_table_privilege('service_role', 'public.workout_assignment_feedback', 'delete')
             and not has_column_privilege('service_role', 'public.workout_assignments', 'title', 'update') then 'ok' else 'TOO MUCH' end
union all
select 'it can already read the people, gym and sender details it needs',
       case when has_table_privilege('service_role', 'public.gym_members', 'select')
             and has_table_privilege('service_role', 'public.profiles', 'select')
             and has_table_privilege('service_role', 'public.gym_communication_settings', 'select')
             and has_column_privilege('service_role', 'public.gyms', 'name', 'select') then 'ok' else 'CANNOT' end;
