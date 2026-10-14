-- Read-only. Run AFTER applying 20261016100000_staff_tables_access.sql. Every row should say "ok".
select 'signed-in users can read, add and change staff details and hours' as check,
       case when has_table_privilege('authenticated', 'public.staff_profiles', 'select')
             and has_table_privilege('authenticated', 'public.staff_profiles', 'insert')
             and has_table_privilege('authenticated', 'public.staff_profiles', 'update')
             and has_table_privilege('authenticated', 'public.staff_working_hours', 'select')
             and has_table_privilege('authenticated', 'public.staff_working_hours', 'insert')
             and has_table_privilege('authenticated', 'public.staff_working_hours', 'update') then 'ok' else 'CANNOT' end as result
union all
select 'but cannot delete them',
       case when not has_table_privilege('authenticated', 'public.staff_profiles', 'delete')
             and not has_table_privilege('authenticated', 'public.staff_working_hours', 'delete') then 'ok' else 'WRONG' end
union all
select 'the public (not signed in) gained nothing',
       case when not has_table_privilege('anon', 'public.staff_profiles', 'select')
             and not has_table_privilege('anon', 'public.staff_working_hours', 'select')
             and not has_table_privilege('anon', 'public.staff_profiles', 'insert')
             and not has_table_privilege('anon', 'public.staff_working_hours', 'insert') then 'ok' else 'WRONG' end
union all
select 'the hours read policy is for the team, not every member',
       case when (select qual from pg_policies where schemaname = 'public' and tablename = 'staff_working_hours' and policyname = 'staff view working hours') like '%has_gym_role%'
             and (select qual from pg_policies where schemaname = 'public' and tablename = 'staff_working_hours' and policyname = 'staff view working hours') not like '%is_gym_member%' then 'ok' else 'WRONG' end;
