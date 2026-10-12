-- Read-only. Run AFTER applying 20261012190000_class_blocks_and_leaderboard.sql. Every row should say "ok".
select 'blocks and their classes exist with row security on' as check,
       case when (select relrowsecurity from pg_class where oid = 'public.class_blocks'::regclass)
             and (select relrowsecurity from pg_class where oid = 'public.class_block_sessions'::regclass) then 'ok' else 'MISSING' end as result
union all
select 'blocks: owners and admins manage, active members read',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_blocks') = 2
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'class_block_sessions') = 2 then 'ok' else 'WRONG' end
union all
select 'a class can only join a block inside its weeks and gym',
       case when exists (select 1 from pg_trigger where tgrelid = 'public.class_block_sessions'::regclass and tgname = 'class_block_session_in_range' and not tgisinternal) then 'ok' else 'MISSING' end
union all
select 'a class workout can carry a score (exercise and what counts)',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_session_workouts' and column_name = 'score_metric')
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_session_workouts' and column_name = 'score_exercise') then 'ok' else 'MISSING' end
union all
select 'a recorded workout can be left off the leaderboard, and scores are shared unless turned off',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workout_sessions' and column_name = 'share_score' and column_default = 'true')
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'member_score_settings' and column_name = 'share_scores' and column_default = 'true') then 'ok' else 'WRONG' end
union all
select 'the show-my-score setting is private to each member',
       case when (select relrowsecurity from pg_class where oid = 'public.member_score_settings'::regclass)
             and has_table_privilege('authenticated', 'public.member_score_settings', 'select')
             and not has_table_privilege('anon', 'public.member_score_settings', 'select')
             and not has_table_privilege('service_role', 'public.member_score_settings', 'select') then 'ok' else 'WRONG' end
union all
select 'the leaderboard function: signed-in only, not public',
       case when has_function_privilege('authenticated', 'public.get_class_leaderboard(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.get_class_leaderboard(uuid)', 'execute') then 'ok' else 'WRONG' end
union all
select 'it is still not callable by anyone not signed in (the public function list is unchanged)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
