-- Read-only. Run AFTER applying 20261016140000_class_waitlist.sql. Every row should say "ok".
select 'the waitlist table exists with row security on, and signed-in people can only read it' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.class_waitlist'::regclass)
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_waitlist') = 2
             and has_table_privilege('authenticated', 'public.class_waitlist', 'select')
             and not has_table_privilege('authenticated', 'public.class_waitlist', 'insert')
             and not has_table_privilege('authenticated', 'public.class_waitlist', 'update')
             and not has_table_privilege('authenticated', 'public.class_waitlist', 'delete')
             and not has_table_privilege('anon', 'public.class_waitlist', 'select') then 'ok' else 'WRONG' end as result
union all
select 'the five member and admin functions can be run by signed-in people and not signed-out ones',
       case when has_function_privilege('authenticated', 'public.member_join_waitlist(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.member_leave_waitlist(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.get_my_waitlist(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.get_my_waitlists(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.get_class_waitlist(uuid, uuid)', 'execute')
             and not has_function_privilege('anon', 'public.member_join_waitlist(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.member_leave_waitlist(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_my_waitlist(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_my_waitlists(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_class_waitlist(uuid, uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the internal functions cannot be run by signed-in or signed-out people',
       case when not has_function_privilege('authenticated', 'private.advance_waitlist(uuid)', 'execute')
             and not has_function_privilege('anon', 'private.advance_waitlist(uuid)', 'execute')
             and not has_function_privilege('authenticated', 'private.waitlist_on_booking_change()', 'execute')
             and not has_function_privilege('authenticated', 'private.waitlist_on_session_change()', 'execute') then 'ok' else 'WRONG' end
union all
select 'a place opening up (booking cancelled or removed, class changed) triggers the line moving on',
       case when exists (select 1 from pg_trigger where tgname = 'class_waitlist_on_booking_change' and tgrelid = 'public.class_bookings'::regclass and not tgisinternal)
             and exists (select 1 from pg_trigger where tgname = 'class_waitlist_on_session_change' and tgrelid = 'public.class_sessions'::regclass and not tgisinternal) then 'ok' else 'MISSING' end
union all
select 'both booking functions hold places offered to other people',
       case when pg_get_functiondef('public.member_book_class(uuid)'::regprocedure) like '%class_waitlist%'
             and pg_get_functiondef('public.book_class_session(uuid)'::regprocedure) like '%class_waitlist%' then 'ok' else 'WRONG' end
union all
select 'a signed-in person can still run the two booking functions',
       case when has_function_privilege('authenticated', 'public.member_book_class(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.book_class_session(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.member_book_class(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.book_class_session(uuid)', 'execute') then 'ok' else 'WRONG' end;
