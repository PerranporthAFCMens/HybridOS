-- Read-only checks after applying 20261011090000_member_join_details.sql. Every row should say "ok".
select 'details table exists with row level security' as check,
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.member_details')) then 'ok' else 'MISSING OR OPEN' end as result
union all
select 'declarations table exists with row level security',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.member_declarations')) then 'ok' else 'MISSING OR OPEN' end
union all
select 'nobody can write the two tables directly',
       case when not has_table_privilege('authenticated', 'public.member_details', 'insert')
             and not has_table_privilege('authenticated', 'public.member_details', 'update')
             and not has_table_privilege('authenticated', 'public.member_declarations', 'insert')
             and not has_table_privilege('authenticated', 'public.member_declarations', 'update')
             and not has_table_privilege('anon', 'public.member_details', 'select') then 'ok' else 'WRONG' end
union all
select 'address and emergency contact are not on profiles',
       case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('address_line1', 'town', 'postcode', 'emergency_name')) then 'ok' else 'ON PROFILES' end
union all
select 'gyms have terms columns, version starts at 1',
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'gyms' and column_name in ('terms_text', 'health_declaration_text', 'terms_version')) = 3
             and not exists (select 1 from public.gyms where terms_version <> 1) then 'ok' else 'WRONG' end
union all
select 'the four public functions exist',
       case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('save_my_join_details', 'get_public_gym_join_terms', 'accept_gym_terms', 'get_members_missing_details')) = 4 then 'ok' else 'MISSING' end
union all
select 'anonymous users cannot call them',
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('save_my_join_details', 'get_public_gym_join_terms', 'accept_gym_terms', 'get_members_missing_details') and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('public', oid, 'execute'))) then 'ok' else 'ANON CAN CALL' end
union all
select 'join function now checks for gaps',
       case when pg_get_functiondef('public.join_public_gym_with_membership(text, uuid)'::regprocedure) like '%member_gaps%' then 'ok' else 'NOT UPDATED' end
union all
select 'no details or declarations exist yet',
       case when (select count(*) from public.member_details) = 0 and (select count(*) from public.member_declarations) = 0 then 'ok' else 'UNEXPECTED' end;
