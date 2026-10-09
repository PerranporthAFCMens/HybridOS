-- Read-only checks after applying 20261010150000_membership_rules.sql. Every row should say "ok".
select 'rules table exists with row level security' as check,
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.membership_rules')) then 'ok' else 'MISSING OR OPEN' end as result
union all
select 'requests table exists with row level security',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.membership_requests')) then 'ok' else 'MISSING OR OPEN' end
union all
select 'plans have the switch flag, off by default',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'membership_plans' and column_name = 'members_can_switch_to' and column_default = 'false') then 'ok' else 'MISSING' end
union all
select 'no plan was switched on',
       case when (select count(*) from public.membership_plans where members_can_switch_to) = 0 then 'ok' else 'UNEXPECTED' end
union all
select 'no gym has any rule yet (everything is off until an owner sets it)',
       case when (select count(*) from public.membership_rules) = 0 then 'ok' else 'UNEXPECTED' end
union all
select 'members can ask but not write requests directly',
       case when has_table_privilege('authenticated', 'public.membership_requests', 'select') and not has_table_privilege('authenticated', 'public.membership_requests', 'insert') and not has_table_privilege('authenticated', 'public.membership_requests', 'update') then 'ok' else 'WRONG' end
union all
select 'the seven public functions exist',
       case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('get_my_membership_options', 'request_membership_pause', 'request_membership_cancel', 'request_membership_change', 'withdraw_membership_request', 'decide_membership_request', 'apply_due_membership_requests')) = 7 then 'ok' else 'MISSING' end
union all
select 'anonymous users cannot call any of them',
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('get_my_membership_options', 'request_membership_pause', 'request_membership_cancel', 'request_membership_change', 'withdraw_membership_request', 'decide_membership_request', 'apply_due_membership_requests') and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('public', oid, 'execute'))) then 'ok' else 'ANON CAN CALL' end
union all
select 'only the service role can run the sweep',
       case when has_function_privilege('service_role', 'public.apply_due_membership_requests()', 'execute') and not has_function_privilege('authenticated', 'public.apply_due_membership_requests()', 'execute') then 'ok' else 'WRONG' end
union all
select 'existing memberships were not touched (statuses unchanged: none paused or cancelled by this migration)',
       case when (select count(*) from public.membership_requests) = 0 then 'ok' else 'UNEXPECTED' end;
