-- Coach benchmark results: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/coach_benchmark_results.sql
begin;
\o /dev/null
create schema pt;
create table pt.results(seq serial, label text, got text, want text, ok boolean);

create function pt.q(uid uuid, stmt text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    execute stmt into r;
  exception when others then
    r := 'ERROR:' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','',true);
  return r;
end $f$;

create function pt.anon(stmt text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  begin execute stmt into r; exception when others then r := 'ERROR:' || sqlerrm; end;
  execute 'reset role';
  return r;
end $f$;

create function pt.check(label text, got text, want text) returns void language plpgsql as $f$
begin
  insert into pt.results(label,got,want,ok) values(label, got, want, got is not distinct from want);
end $f$;

create table pt.persona(name text primary key, uid uuid);
insert into pt.persona values
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('m2','00000000-0000-4000-8000-000000000012'), ('m3','00000000-0000-4000-8000-000000000013'), ('coach_a','00000000-0000-4000-8000-000000000003'), ('m1','00000000-0000-4000-8000-000000000011'),
 ('owner_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021'), ('stranger','00000000-0000-4000-8000-000000000099');
insert into auth.users(id,email) select uid, name||'@cbres.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Result Gym A','cr-a',pt.u('owner_a')),(pt.gym_b(),'Result Gym B','cr-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),(pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),
 (pt.gym_b(),pt.u('owner_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly'),('c0000000-0000-4000-8000-000000000002',pt.gym_b(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values
 (pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 (pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-000000000002','active',current_date-30);

create table pt.ids(k text primary key, v uuid);
grant usage on schema pt to authenticated;
grant select on pt.ids to authenticated;
create function pt.id(k text) returns uuid language sql as $$ select v from pt.ids where pt.ids.k = $1 $$;
with x as (insert into public.movements(gym_id, name) values (pt.gym_a(), '1 km Row') returning id) insert into pt.ids select 'ma', id from x;
with x as (insert into public.class_blocks(gym_id, name, starts_on, weeks) values (pt.gym_a(), 'Hybrid Uppers', current_date - 2, 6) returning id) insert into pt.ids select 'ba', id from x;
with x as (insert into public.class_blocks(gym_id, name, starts_on, weeks) values (pt.gym_b(), 'Other block', current_date, 6) returning id) insert into pt.ids select 'bb', id from x;
with x as (insert into public.class_sessions(gym_id, name, starts_at, ends_at, capacity) values (pt.gym_a(), 'Class', now(), now() + interval '1 hour', 10) returning id) insert into pt.ids select 'sa', id from x;
insert into public.class_block_sessions(session_id, block_id, gym_id) values (pt.id('sa'), pt.id('ba'), pt.gym_a());
insert into public.block_benchmarks(gym_id, block_id, movement_id, test_start_on, test_end_on, better)
  values (pt.gym_a(), pt.id('ba'), pt.id('ma'), current_date - 2, current_date + 33, 'lower');
-- m1 and m2 booked the class (m2 cancelled), m3 did not. m1 recorded the row twice at the start, once outside the test weeks.
insert into public.class_bookings(gym_id, session_id, user_id, status) values
  (pt.gym_a(), pt.id('sa'), pt.u('m1'), 'booked'), (pt.gym_a(), pt.id('sa'), pt.u('m2'), 'cancelled');
create function pt.rec(uid uuid, gym uuid, daysago int, secs int, nm text) returns void language plpgsql as $f$
declare s uuid; e uuid;
begin
  insert into public.workout_sessions(gym_id, user_id, title, performed_at) values (gym, uid, 'W', now() - make_interval(days => daysago)) returning id into s;
  insert into public.workout_entries(session_id, gym_id, user_id, exercise_name, tracking_type) values (s, gym, uid, nm, 'time') returning id into e;
  insert into public.workout_sets(entry_id, set_number, duration_seconds) values (e, 1, secs);
end $f$;
select pt.rec(pt.u('m1'), pt.gym_a(), 1, 250, '1 km row');
select pt.rec(pt.u('m1'), pt.gym_a(), 0, 240, '1 KM ROW');
select pt.rec(pt.u('m1'), pt.gym_a(), 20, 300, '1 km row');
select pt.rec(pt.u('m1'), pt.gym_a(), 1, 90, 'Plank');
select pt.rec(pt.u('m2'), pt.gym_a(), 1, 260, '1 km row');
select pt.rec(pt.u('m3'), pt.gym_a(), 1, 270, '1 km row');
create function pt.res(uid uuid) returns text language sql as $$
  select pt.q(uid, format('select count(*)::text from public.get_block_benchmark_results(%L)', (select v from pt.ids where k = 'ba'))) $$;

-- ---------- the switch ----------
select pt.check('switch off by default: an owner gets nothing', pt.res(pt.u('owner_a')), '0');
select pt.check('switch off by default: a coach gets nothing', pt.res(pt.u('coach_a')), '0');
select pt.check('a coach cannot turn it on', pt.q(pt.u('coach_a'), format('insert into public.gym_benchmark_settings(gym_id, coaches_see_results) values (%L, true) returning 1', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "gym_benchmark_settings"');
select pt.check('a member cannot turn it on', pt.q(pt.u('m1'), format('insert into public.gym_benchmark_settings(gym_id, coaches_see_results) values (%L, true) returning 1', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "gym_benchmark_settings"');
select pt.check('another gym''s owner cannot turn it on here', pt.q(pt.u('owner_b'), format('insert into public.gym_benchmark_settings(gym_id, coaches_see_results) values (%L, true) returning 1', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "gym_benchmark_settings"');
select pt.check('an owner turns it on', pt.q(pt.u('owner_a'), format('insert into public.gym_benchmark_settings(gym_id, coaches_see_results) values (%L, true) returning coaches_see_results::text', pt.gym_a())), 'true');
select pt.check('a member can read the switch', pt.q(pt.u('m1'), 'select coaches_see_results::text from public.gym_benchmark_settings'), 'true');
select pt.check('another gym''s member cannot', pt.q(pt.u('mb'), 'select count(*)::text from public.gym_benchmark_settings'), '0');
select pt.check('signed-out people cannot read it', pt.anon('select count(*)::text from public.gym_benchmark_settings'), 'ERROR:permission denied for table gym_benchmark_settings');

-- ---------- who sees results, and which ----------
select pt.check('a coach sees the booked member''s two test-week rows, not the old or other-movement ones', pt.res(pt.u('coach_a')), '2');
select pt.check('an owner sees the same', pt.res(pt.u('owner_a')), '2');
select pt.check('only the booked member is listed (cancelled and unbooked are left out)', pt.q(pt.u('coach_a'), format('select count(distinct user_id)::text from public.get_block_benchmark_results(%L)', pt.id('ba'))), '1');
select pt.check('the member is named', pt.q(pt.u('coach_a'), format('select min(display_name) from public.get_block_benchmark_results(%L)', pt.id('ba'))), 'm1');
select pt.check('a member gets nothing', pt.res(pt.u('m1')), '0');
select pt.check('another gym''s owner gets nothing', pt.q(pt.u('owner_b'), format('select count(*)::text from public.get_block_benchmark_results(%L)', pt.id('ba'))), '0');
select pt.check('a stranger gets nothing', pt.res(pt.u('stranger')), '0');
select pt.check('signed-out people cannot call it', pt.anon(format('select count(*)::text from public.get_block_benchmark_results(%L)', pt.id('ba'))), 'ERROR:permission denied for function get_block_benchmark_results');
select pt.check('switching it off hides results again', pt.q(pt.u('owner_a'), format('update public.gym_benchmark_settings set coaches_see_results = false where gym_id = %L returning coaches_see_results::text', pt.gym_a())), 'false');
select pt.check('and a coach gets nothing', pt.res(pt.u('coach_a')), '0');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'coach benchmark results: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
