-- Read-only. Run AFTER applying 20261012190000_class_blocks.sql. Every row should say "ok".
select 'blocks and their classes exist with row security on' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.class_blocks'::regclass)
             and (select relrowsecurity from pg_class where oid = 'public.class_block_sessions'::regclass) then 'ok' else 'MISSING' end as result
union all
select 'blocks: owners and admins manage, active members read',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_blocks') = 2
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_block_sessions') = 2 then 'ok' else 'WRONG' end
union all
select 'signed-in people can use them (the rules decide who), nobody else can',
       case when has_table_privilege('authenticated', 'public.class_blocks', 'select')
             and not has_table_privilege('anon', 'public.class_blocks', 'select')
             and not has_table_privilege('service_role', 'public.class_blocks', 'select')
             and not has_table_privilege('anon', 'public.class_block_sessions', 'select')
             and not has_table_privilege('service_role', 'public.class_block_sessions', 'select') then 'ok' else 'WRONG' end
union all
select 'a class can only join a block inside its weeks and gym',
       case when exists (select 1 from pg_trigger where tgrelid = 'public.class_block_sessions'::regclass and tgname = 'class_block_session_in_range' and not tgisinternal) then 'ok' else 'MISSING' end
union all
select 'the helper function is not callable from the app',
       case when not has_function_privilege('authenticated', 'private.enforce_block_session()', 'execute') then 'ok' else 'TOO OPEN' end
union all
select 'the public function list is unchanged (nothing new is callable by someone not signed in)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options', 'get_public_gym_join_style')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
