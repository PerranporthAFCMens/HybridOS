-- Read-only. Run AFTER applying 20261011220000_join_display_name_local_part.sql. Every row should say "ok".
select 'the join function also replaces the automatic name made from the email' as check,
       case when pg_get_functiondef('public.save_my_join_details(text,text,date,text,text,text,text,text,text,text,text,text,text)'::regprocedure) like '%split_part%' then 'ok' else 'OLD FUNCTION' end as result
union all
select 'nobody who has a first and last name still shows the automatic name',
       case when not exists (
         select 1 from public.profiles p join auth.users u on u.id = p.id
          where coalesce(btrim(p.first_name), '') <> '' and coalesce(btrim(p.last_name), '') <> ''
            and (p.display_name like '%@%' or lower(btrim(p.display_name)) = lower(split_part(coalesce(u.email, ''), '@', 1)))
       ) then 'ok' else 'STILL AUTOMATIC' end
union all
select 'anonymous users still cannot call it',
       case when not has_function_privilege('anon', 'public.save_my_join_details(text,text,date,text,text,text,text,text,text,text,text,text,text)', 'execute') then 'ok' else 'ANON CAN CALL IT' end
union all
select 'signed-in users can',
       case when has_function_privilege('authenticated', 'public.save_my_join_details(text,text,date,text,text,text,text,text,text,text,text,text,text)', 'execute') then 'ok' else 'CANNOT CALL IT' end;
