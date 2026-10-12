-- Read-only. Run AFTER applying 20261012170000_admin_invite_signed_in_only.sql. Every row should say "ok".
select 'someone who is not signed in can no longer read an admin invite' as check,
       case when not has_function_privilege('anon', 'public.get_admin_invite(text)', 'execute') then 'ok' else 'STILL PUBLIC' end as result
union all
select 'signed-in people still can',
       case when has_function_privilege('authenticated', 'public.get_admin_invite(text)', 'execute') then 'ok' else 'LOST' end
union all
select 'the public invite page and the public join page still work without signing in',
       case when has_function_privilege('anon', 'public.get_access_invite(text)', 'execute')
             and has_function_privilege('anon', 'public.get_public_gym_join_options(text)', 'execute') then 'ok' else 'BROKEN' end
union all
-- get_public_gym_brand (the login page's gym name and logo) exists on the live project; it may or may not exist elsewhere.
select 'no other security definer function can be run by someone who is not signed in',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
                                and p.proname not in ('get_access_invite', 'get_public_gym_brand', 'get_public_gym_join_options')) then 'ok'
            else 'ANOTHER ONE IS PUBLIC' end;
