-- Every row must say ok. Read-only.
select 'both payment functions exist' as check_name,
       case when to_regprocedure('public.stripe_pack_context(uuid,uuid,uuid)') is not null
             and to_regprocedure('public.stripe_record_pack_purchase(uuid,uuid,uuid,text,integer)') is not null then 'ok' else 'WRONG' end as result
union all
select 'only the payment service can run them (not visitors, not signed-in members)',
       case when has_function_privilege('service_role', 'public.stripe_pack_context(uuid,uuid,uuid)', 'execute')
             and has_function_privilege('service_role', 'public.stripe_record_pack_purchase(uuid,uuid,uuid,text,integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_pack_context(uuid,uuid,uuid)', 'execute')
             and not has_function_privilege('authenticated', 'public.stripe_record_pack_purchase(uuid,uuid,uuid,text,integer)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_pack_context(uuid,uuid,uuid)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_record_pack_purchase(uuid,uuid,uuid,text,integer)', 'execute') then 'ok' else 'WRONG' end
union all
select 'one payment can only ever make one pack',
       case when exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'class_packs' and indexname = 'class_packs_payment_unique') then 'ok' else 'WRONG' end;
