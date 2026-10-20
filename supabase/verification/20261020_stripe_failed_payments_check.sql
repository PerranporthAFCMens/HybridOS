-- Read-only. Every row should say ok.
select 'the four failed-payment functions exist' as check,
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                   and p.proname in ('stripe_record_failed_payment', 'stripe_clear_failed_payment', 'stripe_subscription_event', 'get_my_payment_notice')) = 4 then 'ok' else 'MISSING' end as result
union all
select 'only the Stripe service can run the three stripe_* functions',
       case when has_function_privilege('service_role', 'public.stripe_record_failed_payment(text,text,integer,text,text,text)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_clear_failed_payment(text,text)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_subscription_event(text,text,boolean)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_record_failed_payment(text,text,integer,text,text,text)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_clear_failed_payment(text,text)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_subscription_event(text,text,boolean)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_subscription_event(text,text,boolean)', 'execute') then 'ok' else 'WRONG' end
union all
select 'signed-in members can read their own payment notice, signed-out visitors cannot',
       case when has_function_privilege('authenticated', 'public.get_my_payment_notice(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_my_payment_notice(uuid)', 'execute') then 'ok' else 'WRONG' end;
