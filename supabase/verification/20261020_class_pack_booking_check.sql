-- Every row must say ok. Read-only.
select 'bookings can point at the pack that paid for them' as check_name,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_bookings' and column_name = 'class_pack_id')
             and exists (select 1 from pg_constraint where conrelid = 'public.class_bookings'::regclass and contype = 'f' and confrelid = 'public.class_packs'::regclass) then 'ok' else 'WRONG' end as result
union all
select 'the five helper functions exist and only the database itself can run them',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'private' and p.proname in ('pack_cancel_window', 'member_has_usable_pack', 'spend_pack_credit', 'refund_pack_credit', 'refund_session_packs')) = 5
             and not has_function_privilege('authenticated', 'private.spend_pack_credit(uuid,uuid)', 'execute')
             and not has_function_privilege('authenticated', 'private.refund_pack_credit(uuid)', 'execute')
             and not has_function_privilege('authenticated', 'private.member_has_usable_pack(uuid,uuid)', 'execute')
             and not has_function_privilege('anon', 'private.spend_pack_credit(uuid,uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'a class that is cancelled or deleted gives its pack classes back',
       case when exists (select 1 from pg_trigger where tgrelid = 'public.class_sessions'::regclass and tgname = 'class_pack_refund_on_session_change' and not tgisinternal) then 'ok' else 'WRONG' end
union all
select 'cancelling in time means at least 12 hours before the class',
       case when private.pack_cancel_window() = interval '12 hours' then 'ok' else 'WRONG' end
union all
select 'both booking functions use a pack when the plan has no classes',
       case when pg_get_functiondef('public.member_book_class(uuid)'::regprocedure) like '%spend_pack_credit%'
             and pg_get_functiondef('public.book_class_session(uuid)'::regprocedure) like '%spend_pack_credit%' then 'ok' else 'WRONG' end
union all
select 'all three ways of cancelling give the class back',
       case when pg_get_functiondef('public.member_cancel_class(uuid)'::regprocedure) like '%refund_pack_credit%'
             and pg_get_functiondef('public.cancel_class_booking(uuid)'::regprocedure) like '%refund_pack_credit%'
             and pg_get_functiondef('public.admin_manage_class_booking(uuid,uuid,uuid,text)'::regprocedure) like '%refund_pack_credit%' then 'ok' else 'WRONG' end
union all
select 'the booking and cancel functions can still be run by signed-in members but not by visitors',
       case when has_function_privilege('authenticated', 'public.member_book_class(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.book_class_session(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.member_cancel_class(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.cancel_class_booking(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.admin_manage_class_booking(uuid,uuid,uuid,text)', 'execute')
             and not has_function_privilege('anon', 'public.member_book_class(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.admin_manage_class_booking(uuid,uuid,uuid,text)', 'execute') then 'ok' else 'WRONG' end;
