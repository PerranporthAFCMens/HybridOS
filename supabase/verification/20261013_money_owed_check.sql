-- Read-only. Run AFTER applying 20261013120000_money_owed.sql. Every row should say "ok".
select 'the settlements table exists with row security on, and only owners and admins can read it' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.payment_settlements'::regclass)
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'payment_settlements') = 1
             and has_table_privilege('authenticated', 'public.payment_settlements', 'select')
             and not has_table_privilege('authenticated', 'public.payment_settlements', 'insert')
             and not has_table_privilege('authenticated', 'public.payment_settlements', 'update')
             and not has_table_privilege('authenticated', 'public.payment_settlements', 'delete')
             and not has_table_privilege('anon', 'public.payment_settlements', 'select')
             and not has_table_privilege('service_role', 'public.payment_settlements', 'select') then 'ok' else 'WRONG' end as result
union all
select 'the overdue setting table exists with row security on, 7 days unless the gym changes it, owners and admins only',
       case when (select relrowsecurity from pg_class where oid = 'public.gym_arrears_settings'::regclass)
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gym_arrears_settings' and column_name = 'overdue_grace_days' and column_default = '7')
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_arrears_settings') = 1
             and has_table_privilege('authenticated', 'public.gym_arrears_settings', 'select')
             and not has_table_privilege('anon', 'public.gym_arrears_settings', 'select')
             and not has_table_privilege('service_role', 'public.gym_arrears_settings', 'select') then 'ok' else 'WRONG' end
union all
select 'the four money-owed functions can be run by signed-in people (they check for owner or admin inside) and nobody else',
       case when has_function_privilege('authenticated', 'public.get_gym_arrears(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.get_member_missed_payments(uuid, uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.settle_missed_payment(uuid, uuid, text, text)', 'execute')
             and has_function_privilege('authenticated', 'public.reopen_missed_payment(uuid, uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_gym_arrears(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_member_missed_payments(uuid, uuid)', 'execute')
             and not has_function_privilege('anon', 'public.settle_missed_payment(uuid, uuid, text, text)', 'execute')
             and not has_function_privilege('anon', 'public.reopen_missed_payment(uuid, uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the shared definition of a missed payment cannot be called directly by anyone signed in',
       case when not has_function_privilege('authenticated', 'private.missed_payments(uuid)', 'execute')
             and not has_function_privilege('anon', 'private.missed_payments(uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the public function list is unchanged (nothing new is callable by someone not signed in)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options', 'get_public_gym_join_style')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
