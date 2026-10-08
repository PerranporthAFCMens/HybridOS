-- Read-only: is the booking-management function in place, locked down, and callable only by signed-in users?
select 'function exists' as check, count(*)::text as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'admin_manage_class_booking'
union all
select 'security definer', coalesce(bool_and(p.prosecdef)::text, 'missing')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'admin_manage_class_booking'
union all
select 'anon can run it', has_function_privilege('anon', 'public.admin_manage_class_booking(uuid, uuid, uuid, text)', 'execute')::text
union all
select 'signed-in users can run it', has_function_privilege('authenticated', 'public.admin_manage_class_booking(uuid, uuid, uuid, text)', 'execute')::text
union all
select 'signed-in users can write bookings directly (should be false)', has_table_privilege('authenticated', 'public.class_bookings', 'update')::text;
