-- Every row must say ok. Read-only.
select 'both tables exist with row level security on' as check_name,
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname in ('class_pack_types', 'class_packs') and c.relrowsecurity) = 2 then 'ok' else 'WRONG' end as result
union all
select 'signed-out people have no access',
       case when not has_table_privilege('anon', 'public.class_pack_types', 'select') and not has_table_privilege('anon', 'public.class_packs', 'select') then 'ok' else 'WRONG' end
union all
select 'packs held by members cannot be written directly, only read',
       case when has_table_privilege('authenticated', 'public.class_packs', 'select')
             and not has_table_privilege('authenticated', 'public.class_packs', 'insert')
             and not has_table_privilege('authenticated', 'public.class_packs', 'update')
             and not has_table_privilege('authenticated', 'public.class_packs', 'delete') then 'ok' else 'WRONG' end
union all
select 'the pack rules: two on pack types, two on packs',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_pack_types') = 2
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_packs') = 2 then 'ok' else 'WRONG' end
union all
select 'one payment can only make one pack',
       case when exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'class_packs_payment_unique') then 'ok' else 'WRONG' end
union all
select 'the two owner actions can be run by signed-in people (they check the role inside) but not by visitors',
       case when has_function_privilege('authenticated', 'public.owner_give_class_pack(uuid,uuid,uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.owner_void_class_pack(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.owner_give_class_pack(uuid,uuid,uuid)', 'execute')
             and not has_function_privilege('anon', 'public.owner_void_class_pack(uuid)', 'execute') then 'ok' else 'WRONG' end;
