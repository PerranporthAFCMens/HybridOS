-- Read-only. Run AFTER applying 20261014090000_stripe_payment_provider.sql and 20261014091000_stripe_join_payments.sql. Every row should say "ok".
select 'the payment provider list includes stripe' as check,
       case when exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'payment_provider' and e.enumlabel = 'stripe') then 'ok' else 'MISSING' end as result
union all
select 'the three new tables exist with row security on',
       case when (select count(*) from pg_class where oid in ('public.plan_stripe_prices'::regclass, 'public.member_stripe_customers'::regclass, 'public.membership_agreements'::regclass) and relrowsecurity) = 3 then 'ok' else 'MISSING' end
union all
select 'people can only read the new tables (the rules decide whose), nobody else can touch them',
       case when has_table_privilege('authenticated', 'public.plan_stripe_prices', 'select') and has_table_privilege('authenticated', 'public.member_stripe_customers', 'select') and has_table_privilege('authenticated', 'public.membership_agreements', 'select')
             and not has_table_privilege('authenticated', 'public.plan_stripe_prices', 'insert') and not has_table_privilege('authenticated', 'public.member_stripe_customers', 'insert') and not has_table_privilege('authenticated', 'public.membership_agreements', 'insert')
             and not has_table_privilege('authenticated', 'public.membership_agreements', 'update') and not has_table_privilege('authenticated', 'public.membership_agreements', 'delete')
             and not has_table_privilege('anon', 'public.plan_stripe_prices', 'select') and not has_table_privilege('anon', 'public.member_stripe_customers', 'select') and not has_table_privilege('anon', 'public.membership_agreements', 'select')
             and not has_table_privilege('service_role', 'public.plan_stripe_prices', 'select') and not has_table_privilege('service_role', 'public.member_stripe_customers', 'select') and not has_table_privilege('service_role', 'public.membership_agreements', 'select') then 'ok' else 'WRONG' end
union all
select 'one rule on each new table',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename in ('plan_stripe_prices', 'member_stripe_customers', 'membership_agreements')) = 3 then 'ok' else 'WRONG' end
union all
select 'the five Stripe functions can be run by the Stripe service only',
       case when has_function_privilege('service_role', 'public.stripe_join_context(uuid, uuid, uuid)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_save_plan_price(uuid, text, text, integer, text, text)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_save_customer(uuid, uuid, text, text)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_begin_membership(uuid, uuid, uuid, text, text, text, text, boolean, integer, date)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_join_context(uuid, uuid, uuid)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_save_plan_price(uuid, text, text, integer, text, text)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_save_customer(uuid, uuid, text, text)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_begin_membership(uuid, uuid, uuid, text, text, text, text, boolean, integer, date)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_begin_membership(uuid, uuid, uuid, text, text, text, text, boolean, integer, date)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the sign-up page can ask whether payment is taken (signed in only)',
       case when has_function_privilege('authenticated', 'public.get_gym_payment_mode(text)', 'execute') and not has_function_privilege('anon', 'public.get_gym_payment_mode(text)', 'execute') then 'ok' else 'WRONG' end
union all
select 'joining a paid plan without paying is refused while the gym takes payments (the guard is in the join function)',
       case when pg_get_functiondef('public.join_public_gym_with_membership(text, uuid)'::regprocedure) like '%private.gym_takes_payments%' then 'ok' else 'MISSING' end
union all
select 'the public function list is unchanged (nothing new is callable by someone not signed in)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
