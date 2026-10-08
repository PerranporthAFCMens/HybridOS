-- Read-only: is the class edit function in place, locked down, and callable only by signed-in users?
select 'function exists' as check, count(*)::text as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'update_validated_class_session'
union all
select 'security definer', coalesce(bool_and(p.prosecdef)::text, 'missing')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'update_validated_class_session'
union all
select 'anon can run it', has_function_privilege('anon', 'public.update_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text)', 'execute')::text
union all
select 'signed-in users can run it', has_function_privilege('authenticated', 'public.update_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text)', 'execute')::text;
