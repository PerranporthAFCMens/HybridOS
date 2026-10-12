-- Read-only. Run AFTER applying 20261012200000_lift_leaderboard.sql. Every row should say "ok".
select 'the three new tables exist with row security on' as check,
       case when (select count(*) from pg_class where oid in ('public.tracked_lifts'::regclass, 'public.gym_lift_settings'::regclass, 'public.member_lift_choice'::regclass) and relrowsecurity) = 3 then 'ok' else 'MISSING' end as result
union all
select 'ticked lifts and the gym switch: owners and admins manage, active members read',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tracked_lifts') = 2
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_lift_settings') = 2 then 'ok' else 'WRONG' end
union all
select 'a member can only ever touch their own choice',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'member_lift_choice') = 1 then 'ok' else 'WRONG' end
union all
select 'signed-in people can use the tables (the rules decide who), nobody else can',
       case when has_table_privilege('authenticated', 'public.tracked_lifts', 'select')
             and has_table_privilege('authenticated', 'public.gym_lift_settings', 'select')
             and has_table_privilege('authenticated', 'public.member_lift_choice', 'select')
             and not has_table_privilege('anon', 'public.tracked_lifts', 'select')
             and not has_table_privilege('anon', 'public.gym_lift_settings', 'select')
             and not has_table_privilege('anon', 'public.member_lift_choice', 'select')
             and not has_table_privilege('service_role', 'public.tracked_lifts', 'select')
             and not has_table_privilege('service_role', 'public.gym_lift_settings', 'select')
             and not has_table_privilege('service_role', 'public.member_lift_choice', 'select') then 'ok' else 'WRONG' end
union all
select 'the leaderboard function can be run by signed-in people only',
       case when has_function_privilege('authenticated', 'public.get_lift_leaderboard(uuid, text)', 'execute')
             and not has_function_privilege('anon', 'public.get_lift_leaderboard(uuid, text)', 'execute') then 'ok' else 'WRONG' end
union all
select 'the public function list is unchanged (nothing new is callable by someone not signed in)',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options')) then 'ok' else 'ANOTHER ONE IS PUBLIC' end;
