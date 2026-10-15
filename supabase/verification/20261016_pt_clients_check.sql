-- Read-only. Run AFTER applying 20261016120000_pt_clients.sql and 20261016121000_pt_clients_replies.sql. Every row should say "ok".
select 'the clients list and the switch exist with row security on' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.pt_clients'::regclass)
             and (select relrowsecurity from pg_class where oid = 'public.gym_pt_settings'::regclass) then 'ok' else 'MISSING' end as result
union all
select 'signed-in users can read, add and remove clients but not edit a row',
       case when has_table_privilege('authenticated', 'public.pt_clients', 'select')
             and has_table_privilege('authenticated', 'public.pt_clients', 'insert')
             and has_table_privilege('authenticated', 'public.pt_clients', 'delete')
             and not has_table_privilege('authenticated', 'public.pt_clients', 'update') then 'ok' else 'WRONG' end
union all
select 'the switch can be read, added and changed but not deleted',
       case when has_table_privilege('authenticated', 'public.gym_pt_settings', 'select')
             and has_table_privilege('authenticated', 'public.gym_pt_settings', 'insert')
             and has_table_privilege('authenticated', 'public.gym_pt_settings', 'update')
             and not has_table_privilege('authenticated', 'public.gym_pt_settings', 'delete') then 'ok' else 'WRONG' end
union all
select 'nothing is open to anonymous visitors',
       case when not has_table_privilege('anon', 'public.pt_clients', 'select')
             and not has_table_privilege('anon', 'public.gym_pt_settings', 'select') then 'ok' else 'OPEN' end
union all
select 'the rule function cannot be called directly from the app',
       case when not has_function_privilege('authenticated', 'private.is_my_pt_client(uuid,uuid)', 'execute')
             and not has_function_privilege('anon', 'private.is_my_pt_client(uuid,uuid)', 'execute') then 'ok' else 'CALLABLE' end
union all
select 'every staff rule on member workouts now asks the rule function',
       case when (select count(*) from pg_policies where schemaname = 'public' and qual like '%is_my_pt_client%'
                  and policyname in ('staff_view_gym_workout_sessions','staff_view_gym_workout_entries','staff_view_sets_for_gym_entries','staff_view_gym_personal_bests','staff manage member workout assignments','coaches and the client read workout feedback')) = 6
            and exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'coaches write workout feedback' and with_check like '%is_my_pt_client%') then 'ok' else 'NOT ALL' end;
