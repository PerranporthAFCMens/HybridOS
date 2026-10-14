-- Read-only. Run AFTER applying 20261013100000_stripe_foundation.sql. Every row should say "ok".
select 'the two new tables exist with row security on' as check,
       case when (select count(*) from pg_class where oid in ('public.gym_stripe_accounts'::regclass, 'public.gym_payment_settings'::regclass) and relrowsecurity) = 2 then 'ok' else 'MISSING' end as result
union all
select 'the Stripe link can be read by owners and admins and by nobody else',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_stripe_accounts') = 1
             and has_table_privilege('authenticated', 'public.gym_stripe_accounts', 'select')
             and not has_table_privilege('authenticated', 'public.gym_stripe_accounts', 'insert')
             and not has_table_privilege('authenticated', 'public.gym_stripe_accounts', 'update')
             and not has_table_privilege('authenticated', 'public.gym_stripe_accounts', 'delete')
             and not has_table_privilege('anon', 'public.gym_stripe_accounts', 'select') then 'ok' else 'WRONG' end
union all
select 'only the Stripe connection function can write the Stripe link',
       case when has_table_privilege('service_role', 'public.gym_stripe_accounts', 'insert')
             and has_table_privilege('service_role', 'public.gym_stripe_accounts', 'update')
             and not has_table_privilege('service_role', 'public.gym_stripe_accounts', 'delete') then 'ok' else 'WRONG' end
union all
select 'payment settings: owners and admins manage, members of the gym read',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_payment_settings') = 2
             and has_table_privilege('authenticated', 'public.gym_payment_settings', 'select')
             and not has_table_privilege('anon', 'public.gym_payment_settings', 'select')
             and not has_table_privilege('service_role', 'public.gym_payment_settings', 'select') then 'ok' else 'WRONG' end
union all
select 'payments cannot be switched on before Stripe is linked (the guard is in place)',
       case when exists (select 1 from pg_trigger t where t.tgrelid = 'public.gym_payment_settings'::regclass and t.tgname = 'gym_payment_settings_need_stripe' and not t.tgisinternal) then 'ok' else 'MISSING' end
union all
select 'the public function list is unchanged (nothing new is callable by someone not signed in)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options', 'get_public_gym_join_style')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
