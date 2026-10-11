-- Read-only checks after applying 20261011180000_member_details_edit_and_privacy.sql. Every row should say "ok".
select 'the six new functions exist' as check,
       case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('staff_save_member_details', 'get_member_details', 'set_member_contact_visibility', 'get_member_contact_visibility', 'get_my_private_profile', 'get_gym_member_demographics')) = 6 then 'ok' else 'MISSING' end as result
union all
select 'anonymous users cannot call them',
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('staff_save_member_details', 'get_member_details', 'set_member_contact_visibility', 'get_member_contact_visibility', 'get_my_private_profile', 'get_gym_member_demographics') and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('public', oid, 'execute'))) then 'ok' else 'ANON CAN CALL' end
union all
select 'the settings table exists with row level security and no direct writes',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.gym_privacy_settings'))
             and not has_table_privilege('authenticated', 'public.gym_privacy_settings', 'insert')
             and not has_table_privilege('authenticated', 'public.gym_privacy_settings', 'update')
             and not has_table_privilege('anon', 'public.gym_privacy_settings', 'select') then 'ok' else 'WRONG' end
union all
select 'the team no longer reads member_details directly (only the member does)',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'member_details' and cmd = 'SELECT') = 1
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_details' and policyname = 'members read their own details') then 'ok' else 'STILL OPEN' end
union all
select 'the details table is still closed to direct writes',
       case when not has_table_privilege('authenticated', 'public.member_details', 'insert')
             and not has_table_privilege('authenticated', 'public.member_details', 'update') then 'ok' else 'OPEN' end
union all
select 'no mobile number is left on profiles (everyone in a gym could read it there)',
       case when not exists (select 1 from public.profiles where phone is not null) then 'ok' else 'STILL ON PROFILES' end
union all
select 'other members cannot read date of birth or gender',
       case when not has_column_privilege('authenticated', 'public.profiles', 'date_of_birth', 'select')
             and not has_column_privilege('authenticated', 'public.profiles', 'gender', 'select')
             and has_column_privilege('authenticated', 'public.profiles', 'display_name', 'select') then 'ok' else 'STILL READABLE' end
union all
select 'the older members contact table is team-only',
       case when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'members' and policyname = 'gym users can read members')
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'members' and policyname = 'the team and the person read member contact records') then 'ok' else 'STILL OPEN' end
union all
select 'a trigger keeps the mobile number off profiles',
       case when exists (select 1 from pg_trigger where tgname = 'profiles_keep_phone_out' and tgrelid = 'public.profiles'::regclass) then 'ok' else 'MISSING' end;
