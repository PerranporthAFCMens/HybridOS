-- Read-only. Run AFTER applying 20261011200000_join_display_name.sql. Every row should say "ok".
select 'the join function replaces an email display name' as check,
       case when pg_get_functiondef('public.save_my_join_details(text,text,date,text,text,text,text,text,text,text,text,text,text)'::regprocedure) like '%like ''%@%''%' then 'ok' else 'OLD FUNCTION' end as result
union all
select 'nobody who has a first and last name still shows an email address',
       case when not exists (select 1 from public.profiles where display_name like '%@%' and coalesce(btrim(first_name), '') <> '' and coalesce(btrim(last_name), '') <> '') then 'ok' else 'STILL SHOWING AN EMAIL' end
union all
select 'anonymous users still cannot call it',
       case when not has_function_privilege('anon', 'public.save_my_join_details(text,text,date,text,text,text,text,text,text,text,text,text,text)', 'execute') then 'ok' else 'ANON CAN CALL IT' end
union all
select 'signed-in users can',
       case when has_function_privilege('authenticated', 'public.save_my_join_details(text,text,date,text,text,text,text,text,text,text,text,text,text)', 'execute') then 'ok' else 'CANNOT CALL IT' end;
