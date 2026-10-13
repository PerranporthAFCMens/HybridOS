-- Read-only. Every row should say ok.
select 'plans and memberships have the term and notice columns' as check,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'membership_plans' and column_name in ('min_term_months', 'notice_days')) or (table_name = 'memberships' and column_name in ('term_months', 'notice_days')))) = 4 then 'ok' else 'MISSING' end as result
union all
select 'a new membership takes its plan''s terms (trigger in place)',
       case when exists (select 1 from pg_trigger where tgname = 'memberships_copy_plan_terms' and not tgisinternal) then 'ok' else 'MISSING' end
union all
select 'the staff actions log exists with row security on, readable by owners and admins only',
       case when (select relrowsecurity from pg_class where oid = 'public.membership_staff_actions'::regclass)
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'membership_staff_actions') = 1
             and has_table_privilege('authenticated', 'public.membership_staff_actions', 'select')
             and not has_table_privilege('authenticated', 'public.membership_staff_actions', 'insert')
             and not has_table_privilege('authenticated', 'public.membership_staff_actions', 'update')
             and not has_table_privilege('authenticated', 'public.membership_staff_actions', 'delete')
             and not has_table_privilege('anon', 'public.membership_staff_actions', 'select')
             and not has_table_privilege('service_role', 'public.membership_staff_actions', 'select') then 'ok' else 'WRONG' end
union all
select 'the three staff functions can be run by signed-in people (they check owner or admin inside) and nobody else',
       case when has_function_privilege('authenticated', 'public.staff_end_membership(uuid, date, text)', 'execute')
             and has_function_privilege('authenticated', 'public.staff_release_from_term(uuid, text)', 'execute')
             and has_function_privilege('authenticated', 'public.apply_plan_terms_to_members(uuid, text)', 'execute')
             and not has_function_privilege('anon', 'public.staff_end_membership(uuid, date, text)', 'execute')
             and not has_function_privilege('anon', 'public.staff_release_from_term(uuid, text)', 'execute')
             and not has_function_privilege('anon', 'public.apply_plan_terms_to_members(uuid, text)', 'execute')
             and not has_function_privilege('service_role', 'public.staff_end_membership(uuid, date, text)', 'execute') then 'ok' else 'WRONG' end
union all
select 'cancelling uses the member''s own notice and term',
       case when pg_get_functiondef('public.request_membership_cancel(uuid, text)'::regprocedure) like '%m.notice_days%'
             and pg_get_functiondef('public.request_membership_cancel(uuid, text)'::regprocedure) like '%m.term_months%'
             and pg_get_functiondef('public.get_my_membership_options(uuid)'::regprocedure) like '%m.notice_days%' then 'ok' else 'MISSING' end
union all
select 'the sign-up page and the payment step are given each plan''s terms',
       case when pg_get_functiondef('public.get_public_gym_join_options(text)'::regprocedure) like '%min_term_months%'
             and pg_get_functiondef('public.stripe_join_context(uuid, uuid, uuid)'::regprocedure) like '%min_term_months%' then 'ok' else 'MISSING' end
union all
select 'the public function list is unchanged (nothing new is callable by someone not signed in)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
