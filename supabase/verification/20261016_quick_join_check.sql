-- Read-only. Every row should say ok.
select 'the join settings table exists, signed-in people may only read it (the team, through row security), and signed-out people nothing' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.gym_join_settings'::regclass)
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_join_settings') = 1
             and has_table_privilege('authenticated', 'public.gym_join_settings', 'select')
             and not has_table_privilege('authenticated', 'public.gym_join_settings', 'insert')
             and not has_table_privilege('authenticated', 'public.gym_join_settings', 'update')
             and not has_table_privilege('authenticated', 'public.gym_join_settings', 'delete')
             and not has_table_privilege('anon', 'public.gym_join_settings', 'select') then 'ok' else 'WRONG' end as result
union all
select 'a gym with no settings row defaults to full join (nothing changes until a gym switches)',
       case when (select (private.join_settings_for('00000000-0000-0000-0000-000000000000'::uuid)).join_style) = 'full' then 'ok' else 'WRONG' end
union all
select 'the address and emergency contact may be empty until the person gives them',
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'member_details'
                    and column_name in ('address_line1', 'town', 'postcode', 'emergency_name', 'emergency_phone', 'emergency_relationship') and is_nullable = 'YES') = 6 then 'ok' else 'WRONG' end
union all
select 'the six signed-in functions can be run by signed-in people and not signed-out ones',
       case when has_function_privilege('authenticated', 'public.save_my_basics(text, text, date, text, text, text)', 'execute')
             and has_function_privilege('authenticated', 'public.save_my_emergency(text, text, text)', 'execute')
             and has_function_privilege('authenticated', 'public.save_my_address(text, text, text, text)', 'execute')
             and has_function_privilege('authenticated', 'public.get_my_ready_status(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.save_join_settings(uuid, text, text, text, text, boolean)', 'execute')
             and has_function_privilege('authenticated', 'public.get_unfinished_members(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.save_my_basics(text, text, date, text, text, text)', 'execute')
             and not has_function_privilege('anon', 'public.save_my_emergency(text, text, text)', 'execute')
             and not has_function_privilege('anon', 'public.save_my_address(text, text, text, text)', 'execute')
             and not has_function_privilege('anon', 'public.get_my_ready_status(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.save_join_settings(uuid, text, text, text, text, boolean)', 'execute')
             and not has_function_privilege('anon', 'public.get_unfinished_members(uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the sign-up page can read the join style without signing in',
       case when has_function_privilege('anon', 'public.get_public_gym_join_style(text)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the helpers are private (only the door code check is open to signed-in people, because row security runs it)',
       case when not has_function_privilege('authenticated', 'private.join_settings_for(uuid)', 'execute')
             and not has_function_privilege('authenticated', 'private.member_ready_items(uuid, uuid)', 'execute')
             and not has_function_privilege('authenticated', 'private.member_is_ready(uuid, uuid)', 'execute')
             and has_function_privilege('authenticated', 'private.member_may_see_door_code(uuid)', 'execute')
             and not has_function_privilege('anon', 'private.member_may_see_door_code(uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the door code is held back by the access settings policy',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gym_access_settings'
                           and policyname = 'access settings readable by active members' and qual like '%member_may_see_door_code%') then 'ok' else 'MISSING' end
union all
select 'the join check knows about Quick join',
       case when pg_get_functiondef('private.member_gaps(uuid, uuid)'::regprocedure) like '%quick%' then 'ok' else 'MISSING' end;
