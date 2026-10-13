-- Read-only. Every row should say ok.
select 'no card brand, last four digits or expiry is kept in the database' as check,
       case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'member_stripe_customers' and column_name ~ '(card|last4|exp_)') then 'ok' else 'STILL THERE' end as result
union all
select 'the Stripe payment-method token is still kept (it is only a code, useless without the secret key)',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'member_stripe_customers' and column_name = 'payment_method_id') then 'ok' else 'MISSING' end
union all
select 'activating a membership no longer touches any card detail',
       case when pg_get_functiondef('public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)'::regprocedure) !~ 'card_last4|card_brand|card_exp' then 'ok' else 'STILL SAVES CARD DETAILS' end
union all
select 'only the Stripe service can run it',
       case when has_function_privilege('service_role', 'public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer)', 'execute') then 'ok' else 'WRONG' end;
